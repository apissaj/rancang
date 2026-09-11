#!/usr/bin/env node
// Stable entry point for the Rancang MCP server.
//
//   node mcp-server.mjs            → HTTP (Streamable) on http://127.0.0.1:3110/mcp
//   node mcp-server.mjs --stdio    → stdio (Claude Code / Cursor / Codex)
//
// Kept at the repo root so MCP client configs can point at one stable path.
import "./src/lib/mcp/server-http.mjs";
