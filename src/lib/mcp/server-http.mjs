// Rancang MCP server entry — two transports, one shared store:
//
//   HTTP (Streamable):  node server-http.mjs            → listens on :3110 (RANCANG_MCP_PORT)
//                       used by Hermes, other remote agents, and the web app
//   stdio:              node server-http.mjs --stdio    → used by Claude Code / Cursor / Codex
//
// Blueprints live in JSON under ~/.rancang/blueprints (override RANCANG_HOME).
// The web app (Rancang) writes to the same folder, so whatever the MCP server
// sees is exactly what the web app produced.

import http from "node:http";
import { randomUUID } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { registerTools } from "./tools.mjs";

const info = {
  name: "rancang-mcp",
  version: "0.1.0",
};

async function createServer() {
  const server = new Server(info, { capabilities: { tools: {} } });
  await registerTools(server, { CallToolRequestSchema, ListToolsRequestSchema });
  return server;
}

// ---------------------------------------------------------------------------
// stdio transport (Claude Code / Cursor / Codex / `npx rancang-mcp`)
// ---------------------------------------------------------------------------
async function runStdio() {
  const server = await createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[rancang-mcp] stdio transport connected — blueprints at ~/.rancang/blueprints");
}

// ---------------------------------------------------------------------------
// HTTP transport (Streamable HTTP / MCP over HTTP)
// ---------------------------------------------------------------------------
// Session map, not transport-per-request: the MCP handshake is stateful, so a
// fresh transport on every POST loses the "initialized" state and the SDK
// rejects follow-up calls with "Server not initialized". One transport is
// created on initialize and reused for every call carrying its session id.

const MAX_BODY_BYTES = 1_000_000; // 1 MB

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    let bytes = 0;
    req.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        req.destroy(); // kill connection immediately
        reject(new Error("Payload too large (max 1 MB)"));
        return;
      }
      data += chunk;
    });
    req.on("end", () => {
      if (!data) return resolve(undefined);
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

async function runHttp() {
  const port = Number(process.env.RANCANG_MCP_PORT || 3110);
  const sessions = new Map(); // sessionId -> transport

  // Stale-session reaper: if a client initializes a session and never closes it
  // (crash, tab close, no DELETE), the transport would linger forever and the
  // sessions map would grow unbounded. Sweep sessions idle > 30 minutes.
  const SESSION_TTL_MS = 30 * 60 * 1000;
  const sessionLastSeen = new Map(); // sessionId -> timestamp
  const sweepSessions = () => {
    const now = Date.now();
    for (const [sid, seen] of sessionLastSeen) {
      if (now - seen > SESSION_TTL_MS) {
        const transport = sessions.get(sid);
        if (transport && typeof transport.close === "function") {
          try { transport.close(); } catch { /* already closed */ }
        }
        sessions.delete(sid);
        sessionLastSeen.delete(sid);
      }
    }
  };
  setInterval(sweepSessions, 5 * 60 * 1000).unref?.();

  // Basic per-IP rate limit for the local MCP endpoint. Not for abuse on the
  // loopback (low risk), but cheap insurance if the port ever gets exposed.
  const MCP_RATE_MAX = 120; // requests per window
  const MCP_RATE_WINDOW_MS = 60_000;
  const rateBuckets = new Map(); // ip -> { count, resetAt }
  function rateLimited(ip) {
    const now = Date.now();
    const b = rateBuckets.get(ip);
    if (!b || now >= b.resetAt) {
      rateBuckets.set(ip, { count: 1, resetAt: now + MCP_RATE_WINDOW_MS });
      return false;
    }
    b.count++;
    return b.count > MCP_RATE_MAX;
  }
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of rateBuckets) if (v.resetAt <= now) rateBuckets.delete(k);
  }, 60_000).unref?.();

  // Local web app (Rancang :3100) is the only allowed browser origin. Anything
  // else (a random website hitting http://127.0.0.1:3110 via the victim's
  // browser = DNS rebinding / CSRF) gets no CORS and is rejected pre-handshake.
  const ALLOWED_ORIGIN = process.env.RANCANG_MCP_ORIGIN || "http://localhost:3100";

  const httpServer = http.createServer(async (req, res) => {
    // CORS so the Rancang web app can call this from a different origin.
    const { origin } = req.headers;
    const originOk = !origin || origin === ALLOWED_ORIGIN || origin === "http://127.0.0.1:3100";
    if (!originOk) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "origin not allowed" }));
      return;
    }
    res.setHeader("Access-Control-Allow-Origin", origin || ALLOWED_ORIGIN);
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id, Origin");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, service: "rancang-mcp", port, sessions: sessions.size }));
      return;
    }

    if (!req.url?.startsWith("/mcp")) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not found", hint: "POST /mcp" }));
      return;
    }

    const clientIp = req.socket.remoteAddress || "unknown";
    if (rateLimited(clientIp)) {
      res.writeHead(429, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32029, message: "Rate limit exceeded" }, id: null }));
      return;
    }

    let body;
    try {
      body = await readBody(req);
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null }));
      return;
    }

    try {
      const sessionId = req.headers["mcp-session-id"];
      let transport = sessionId ? sessions.get(sessionId) : undefined;

      if (!transport) {
        // A session starts with an initialize request; anything else is invalid.
        const isInit = body && !Array.isArray(body) && body.method === "initialize";
        if (sessionId || !isInit) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              error: { code: -32000, message: "Bad Request: Server not initialized" },
              id: null,
            })
          );
          return;
        }
        // Fresh server+transport per session. Tools are stateless (they read and
        // write ~/.rancang/blueprints), so this costs nothing but a handler table.
        const server = await createServer();
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: randomUUID,
          onsessioninitialized: (sid) => {
            sessions.set(sid, transport);
            sessionLastSeen.set(sid, Date.now());
          },
        });
        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid) {
            sessions.delete(sid);
            sessionLastSeen.delete(sid);
          }
        };
        await server.connect(transport);
      } else {
        sessionLastSeen.set(sessionId, Date.now());
      }

      await transport.handleRequest(req, res, body);
    } catch (err) {
      console.error("[rancang-mcp] request failed:", err);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32603, message: err instanceof Error ? err.message : "internal error" },
            id: null,
          })
        );
      }
    }
  });

  httpServer.listen(port, "127.0.0.1", () => {
    console.error(`[rancang-mcp] HTTP transport listening on http://127.0.0.1:${port}/mcp`);
  });
}

const isStdio = process.argv.includes("--stdio");
if (isStdio) runStdio();
else runHttp();