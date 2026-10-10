#!/usr/bin/env node

/**
 * rancang — CLI tool for Rancang project management
 *
 * Usage:
 *   rancang plan list                      List all blueprints
 *   rancang plan get <id|prefix>           Get blueprint details
 *   rancang task list <id|prefix>          List tasks for a blueprint
 *   rancang task get <id|prefix> <taskId>  Get detailed task prompt (stdout)
 *   rancang task complete <id> <taskId>    Mark task as done
 *   rancang search <query> [blueprintId]   Search tasks across blueprints
 *   rancang version <id> [note]            Snapshot a blueprint version
 *   rancang versions <id>                  List saved versions of a blueprint
 *   rancang history <id>                   Show execution log for a blueprint
 *   rancang init [dir] [--format <f>]      Scaffold project via MCP API
 *   rancang status <id|prefix>             Show project status
 */

import chalk from "chalk";
import { existsSync, mkdirSync } from "fs";
import { resolveBlueprint, listBlueprints, parseTasks, buildTaskPrompt, summarizeTasks, completeTask, nextTask } from "./lib/mcp/store.mjs";
import path from "path";

function printJson(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

function printTable(rows, headers) {
  const colWidths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => String(r[i] || "").length))
  );
  const sep = headers.map((w) => "─".repeat(w)).join("─┬─");
  console.log(headers.map((h, i) => h.padEnd(colWidths[i])).join(" │ "));
  console.log(sep);
  for (const row of rows) {
    console.log(row.map((v, i) => String(v || "").padEnd(colWidths[i])).join(" │ "));
  }
}

const API_BASE = process.env.RANCANG_API || "http://127.0.0.1:3100";

async function fetchJson(url, options) {
  const resp = await fetch(url, options);
  const text = await resp.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!resp.ok) {
    const message = data?.error || text.slice(0, 200) || resp.statusText;
    throw new Error(`${resp.status} ${message}`);
  }
  return data;
}

function fmtTime(ms) {
  if (!ms) return "";
  return new Date(ms).toISOString().replace("T", " ").slice(0, 16);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(`
Usage: rancang <command> [options]

Commands:
  init [dir] [--format <f>]   Scaffold project files via MCP API
  plan list                   List all blueprints
  plan get <id>               Show blueprint details
  task list <id>              List all tasks for a blueprint
  task get <id> <taskId>      Get detailed prompt for a task (to stdout)
  task complete <id> <taskId> Mark a task as completed
  search <query> [blueprintId]  Search tasks across blueprints (HTTP API)
  version <id> [note]         Snapshot a blueprint version (HTTP API)
  versions <id>               List saved versions of a blueprint (HTTP API)
  history <id>                Show execution log for a blueprint (HTTP API)
  sync [dir]                  Index codebase for coding agent context
  detect [dir]                Detect AI coding agents in environment
  status <id>                 Show blueprint progress summary
`);
    return;
  }

  const cmd = args[0];

  if (cmd === "init") {
    const targetDir = args[1] || ".";
    const formatIdx = args.indexOf("--format");
    const format = formatIdx >= 0 ? args[formatIdx + 1] || "all" : "all";

    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    // Call the scaffold API
    const apiUrl = process.env.RANCANG_API || "http://127.0.0.1:3100";
    const resp = await fetch(`${apiUrl}/api/mcp/scaffold`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetDir, format }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      console.error("Scaffold API error:", resp.status, err.slice(0, 200));
      process.exit(1);
    }
    const data = await resp.json();
    console.log(`✓ Blueprint scaffolded in ${targetDir}`);
    console.log(`  Format: ${format}`);
    printJson({ filesWritten: data.filesWritten, blueprintId: data.blueprintId });
    return;
  }

  if (cmd === "sync") {
    const dir = path.resolve(args[1] || ".");
    const apiUrl = process.env.RANCANG_API || "http://127.0.0.1:3100";
    try {
      const resp = await fetch(`${apiUrl}/api/mcp/sync?dir=${encodeURIComponent(dir)}`);
      if (!resp.ok) {
        console.error("Sync error:", resp.status, (await resp.text()).slice(0, 200));
        process.exit(1);
      }
      const data = await resp.json();
      console.log(`✓ Codebase indexed: ${data.root}`);
      console.log(`Files: ${data.totalFiles}${data.truncated ? " (truncated)" : ""}`);
      console.log("\n── File Tree ──");
      console.log(data.tree?.split("\n").slice(0, 30).join("\n") || "(empty)");
      console.log("\n── Key Files ──");
      for (const [name] of Object.entries(data.keyFiles || {})) {
        console.log(`  • ${name}`);
      }
    } catch (err) {
      console.error("Sync failed — apakah server Rancang aktif di :3100?");
      console.error(err.message);
      process.exit(1);
    }
    return;
  }

  if (cmd === "detect") {
    const dir = args[1] || ".";
    const apiUrl = process.env.RANCANG_API || "http://127.0.0.1:3100";
    try {
      const resp = await fetch(`${apiUrl}/api/mcp/detect?dir=${encodeURIComponent(dir)}`);
      if (!resp.ok) {
        console.error("Detect error:", resp.status, (await resp.text()).slice(0, 200));
        process.exit(1);
      }
      const data = await resp.json();
      console.log(`Pendeteksian agent di ${dir}`);
      console.log(`Rekomendasi format: ${data.recommended}`);
      console.log(`Terdeteksi: ${data.detectedCount} agent`);
      for (const a of data.agents || []) {
        if (a.found) {
          console.log(`  ✓ ${a.name} (${a.indicator || "config ditemukan"})`);
        }
      }
    } catch (err) {
      console.error("Detect failed — apakah server Rancang aktif di :3100?");
      console.error(err.message);
      process.exit(1);
    }
    return;
  }

  if (cmd === "plan" && args[1] === "list") {
    const blueprints = listBlueprints();
    printTable(
      blueprints.map((b) => [
        b.id.slice(0, 8) + "…",
        (b.title || "Untitled").slice(0, 35),
        String(b.createdAt || "").slice(0, 10) || "",
      ]),
      ["ID", "Title", "Created"]
    );
    return;
  }

  if ((cmd === "plan" && args[1] === "get") || (cmd === "plan" && !args[1])) {
    const id = args[1] || "latest";
    const record = resolveBlueprint(id);
    if (!record) {
      console.error("Blueprint not found:", id);
      process.exit(1);
    }
    printJson({
      id: record.id,
      title: record.title,
      idea: record.idea?.slice(0, 300) || "",
      createdAt: record.createdAt,
      docs: Object.keys(record.docs || {}),
    });
    return;
  }

  if (cmd === "task" && args[1] === "list") {
    const record = resolveBlueprint(args[2]);
    if (!record) {
      console.error("Blueprint not found:", args[2]);
      process.exit(1);
    }
    const tasks = parseTasks(record.docs?.tasks || "");
    const summary = summarizeTasks(record.docs?.tasks || "");
    const next = nextTask(record.id);

    console.log(`Blueprint: ${record.title || record.id}`);
    console.log(`Tasks: ${summary.done}/${summary.total} done, next: ${next?.next?.id || "all done"}\n`);

    printTable(
      tasks.map((t) => [
        t.id,
        t.phase?.slice(0, 15) || "",
        t.done ? "✅" : "⬜",
        t.text.slice(0, 55),
      ]),
      ["ID", "Phase", " ", "Description"]
    );
    return;
  }

  if (cmd === "task" && args[1] === "get") {
    const record = resolveBlueprint(args[2]);
    if (!record) {
      console.error("Blueprint not found:", args[2]);
      process.exit(1);
    }
    const tasks = parseTasks(record.docs?.tasks || "");
    const task = tasks.find((t) => t.id === args[3]);
    if (!task) {
      console.error("Task not found:", args[3]);
      process.exit(1);
    }
    const prompt = buildTaskPrompt(record, task);
    console.log(prompt);
    return;
  }

  if (cmd === "task" && args[1] === "complete") {
    completeTask(args[2], args[3], true);
    const record = resolveBlueprint(args[2]);
    const summary = summarizeTasks(record?.docs?.tasks || "");
    const nextResult = nextTask(args[2]);
    const nextTaskObj = nextResult?.next;
    console.log(`✓ Task ${args[3]} completed`);
    console.log(`Progress: ${summary.done}/${summary.total} done`);
    if (nextTaskObj) console.log(`Next task: ${nextTaskObj.id} — ${nextTaskObj.text.slice(0, 50)}`);
    else console.log("🎉 All tasks completed!");
    return;
  }

  if (cmd === "search") {
    const query = args[1];
    const blueprintId = args[2];
    if (!query) {
      console.error("Usage: rancang search <query> [blueprintId]");
      process.exit(1);
    }
    try {
      const params = new URLSearchParams({ query });
      if (blueprintId) params.set("blueprint_id", blueprintId);
      const data = await fetchJson(`${API_BASE}/api/mcp/search?${params.toString()}`);

      console.log(`Query: ${chalk.cyan(data.query)}`);
      console.log(
        `Scope: ${data.blueprintId ? chalk.magenta(data.blueprintId) : chalk.gray("all blueprints")}`
      );
      console.log(`Matches: ${chalk.bold(String(data.count))}\n`);

      if (!data.count) {
        console.log(chalk.yellow("No matching tasks."));
        return;
      }

      printTable(
        data.results.map((r) => [
          r.id,
          r.done ? "✅" : "⬜",
          (r.blueprintTitle || r.blueprintId || "").slice(0, 24),
          (r.phase || "").slice(0, 16),
          (r.text || "").slice(0, 55),
        ]),
        ["ID", " ", "Blueprint", "Phase", "Task"]
      );
    } catch (err) {
      console.error(chalk.red("Search failed — apakah server Rancang aktif di :3100?"));
      console.error(err.message);
      process.exit(1);
    }
    return;
  }

  if (cmd === "version") {
    const blueprintId = args[1];
    if (!blueprintId) {
      console.error("Usage: rancang version <blueprintId> [note]");
      process.exit(1);
    }
    const note = args.slice(2).join(" ");
    try {
      const data = await fetchJson(`${API_BASE}/api/mcp/version`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blueprint_id: blueprintId, note }),
      });
      console.log(chalk.green(`✓ Version ${data.versionId} saved`));
      console.log(`  Blueprint: ${chalk.magenta(blueprintId)}`);
      if (note) console.log(`  Note: ${note}`);
      console.log(`  Total versions: ${chalk.bold(String(data.totalVersions))}`);
    } catch (err) {
      console.error(chalk.red("Version failed — apakah server Rancang aktif di :3100?"));
      console.error(err.message);
      process.exit(1);
    }
    return;
  }

  if (cmd === "versions") {
    const blueprintId = args[1];
    if (!blueprintId) {
      console.error("Usage: rancang versions <blueprintId>");
      process.exit(1);
    }
    try {
      const params = new URLSearchParams({ blueprint_id: blueprintId });
      const data = await fetchJson(`${API_BASE}/api/mcp/versions?${params.toString()}`);

      console.log(`Blueprint: ${chalk.magenta(data.blueprintId)}`);
      console.log(`Versions: ${chalk.bold(String(data.count))}\n`);

      if (!data.count) {
        console.log(chalk.yellow("No versions saved yet — run `rancang version <id> [note]`."));
        return;
      }

      printTable(
        data.versions.map((v) => [
          v.id,
          fmtTime(v.timestamp),
          v.summary ? `${v.summary.done}/${v.summary.total}` : "-",
          (v.note || "").slice(0, 40),
        ]),
        ["Version", "Timestamp", "Tasks", "Note"]
      );
    } catch (err) {
      console.error(chalk.red("Versions failed — apakah server Rancang aktif di :3100?"));
      console.error(err.message);
      process.exit(1);
    }
    return;
  }

  if (cmd === "history") {
    const blueprintId = args[1];
    if (!blueprintId) {
      console.error("Usage: rancang history <blueprintId>");
      process.exit(1);
    }
    try {
      const params = new URLSearchParams({ blueprint_id: blueprintId });
      const data = await fetchJson(`${API_BASE}/api/mcp/history?${params.toString()}`);

      console.log(`Blueprint: ${chalk.magenta(data.blueprintId)}`);
      console.log(`Entries: ${chalk.bold(String(data.count))}\n`);

      if (!data.count) {
        console.log(chalk.yellow("No execution history yet."));
        return;
      }

      printTable(
        data.logs.map((l) => [
          fmtTime(l.timestamp),
          l.action === "complete" ? chalk.green("complete") : chalk.yellow(l.action || ""),
          l.taskId,
        ]),
        ["Timestamp", "Action", "Task"]
      );
    } catch (err) {
      console.error(chalk.red("History failed — apakah server Rancang aktif di :3100?"));
      console.error(err.message);
      process.exit(1);
    }
    return;
  }

  if (cmd === "status") {
    const id = args[1] || "latest";
    const record = resolveBlueprint(id);
    if (!record) {
      console.error("Blueprint not found:", id);
      process.exit(1);
    }
    const summary = summarizeTasks(record.docs?.tasks || "");
    const next = nextTask(record.id);
    printJson({
      id: record.id,
      title: record.title || "(untitled)",
      progress: `${summary.done}/${summary.total}`,
      percent: summary.total > 0 ? Math.round((summary.done / summary.total) * 100) : 0,
      nextTask: next?.next ? { id: next.next.id, text: next.next.text.slice(0, 60) } : null,
    });
    return;
  }

  console.error("Unknown command:", cmd);
  process.exit(1);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});