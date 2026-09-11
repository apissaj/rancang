// Tool definitions + handlers for the Rancang MCP server.
//
// The point of this server: once a blueprint (PRD + spec + plan + tasks) is
// finished in Rancang, a coding agent (Claude Code, Cursor, Codex, Hermes,
// OpenCode, ...) can pull it straight out of Rancang, get a ready-to-run
// execution prompt, then work through the task list one task at a time.
//
// WHY PLAIN JSON SCHEMA (and not zod):
// The SDK only converts zod -> JSON Schema on the high-level `McpServer` path
// (mcp.js `registerTool`). This server uses the low-level `Server` +
// setRequestHandler so the same registration works for both the stdio and the
// HTTP transport. On that path `inputSchema` is forwarded VERBATIM, so a zod
// object reaches the client as raw zod internals and fails client-side
// validation (pydantic: `tools.N.inputSchema.type Field required`).
// We therefore declare each schema as literal JSON Schema and validate
// arguments here, in `checkArgs`, before they reach a handler.

import {
  DOC_NAMES,
  buildExecutionPrompt,
  completeTask,
  latestBlueprint,
  listBlueprints,
  nextTask,
  readBlueprint,
  resolveBlueprint,
  saveBlueprint,
  summarizeTasks,
  rancangHome,
  blueprintDir,
} from "./store.mjs";

function text(value) {
  return {
    content: [
      { type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) },
    ],
  };
}

function fail(err) {
  return {
    isError: true,
    content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }],
  };
}

/** JSON Schema fragments reused across tools. */
const ID_SCHEMA = {
  type: "string",
  description:
    "Blueprint id or a unique id prefix. Omit for the most recently updated blueprint.",
};
const DOC_ENUM = { type: "string", enum: DOC_NAMES };

/**
 * Minimal argument validator. Not a full JSON Schema engine — it enforces the
 * parts that actually matter for these tools: required keys present, unknown
 * enums rejected, and string->boolean / string->array coercion so agents that
 * send everything as strings still work.
 */
function checkArgs(schema, args) {
  const input = args && typeof args === "object" ? { ...args } : {};
  const props = schema.properties ?? {};
  const required = schema.required ?? [];

  for (const key of required) {
    if (input[key] === undefined || input[key] === null || input[key] === "") {
      throw new Error(`Missing required argument: ${key}`);
    }
  }

  for (const [key, value] of Object.entries(input)) {
    const spec = props[key];
    if (!spec) continue; // tolerate extra keys

    if (spec.enum && !spec.enum.includes(value)) {
      throw new Error(`Invalid value for ${key}: ${JSON.stringify(value)} (expected one of ${spec.enum.join(", ")})`);
    }

    if (spec.type === "boolean" && typeof value === "string") {
      if (value === "true") input[key] = true;
      else if (value === "false") input[key] = false;
    }

    if (spec.type === "array" && typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) input[key] = parsed;
      } catch {
        input[key] = value
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }

    if (spec.type === "array" && Array.isArray(input[key]) && spec.items?.enum) {
      for (const item of input[key]) {
        if (!spec.items.enum.includes(item)) {
          throw new Error(
            `Invalid value in ${key}: ${JSON.stringify(item)} (expected one of ${spec.items.enum.join(", ")})`
          );
        }
      }
    }
  }

  return input;
}

export const TOOLS = [
  {
    name: "rancang_list_blueprints",
    title: "List Rancang blueprints",
    description:
      "List every finished Rancang blueprint (PRD, spec, plan, tasks) available on this machine, newest first. Use this first to find the blueprint you are about to implement.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: () => {
      const items = listBlueprints().map((b) => ({
        id: b.id,
        title: b.title,
        idea: b.idea,
        model: b.model,
        source: b.source,
        updatedAt: new Date(b.updatedAt ?? b.createdAt).toISOString(),
        docs: b.docs,
        tasks: b.tasks,
      }));
      if (items.length === 0) {
        return text(
          "No blueprints yet. Generate one in Rancang (http://localhost:3100/plan) and it will show up here."
        );
      }
      return text({ count: items.length, blueprints: items });
    },
  },

  {
    name: "rancang_read_blueprint",
    title: "Read a Rancang blueprint",
    description:
      "Read the documents of a blueprint. Omit `docs` to get all four. Prefer reading `spec` and `tasks` first — spec holds the P1 MVP story, tasks holds the ordered work list.",
    inputSchema: {
      type: "object",
      properties: {
        id: ID_SCHEMA,
        docs: {
          type: "array",
          items: DOC_ENUM,
          description: "Which documents to return: prd, spec, plan, tasks. Defaults to all.",
        },
      },
      additionalProperties: false,
    },
    handler: ({ id, docs }) => {
      const record = resolveBlueprint(id);
      if (!record) throw new Error(`Blueprint not found: ${id ?? "latest"}`);
      const wanted = docs?.length ? docs : DOC_NAMES;
      const out = {
        id: record.id,
        title: record.title,
        idea: record.idea,
        model: record.model,
        docs: {},
      };
      for (const name of wanted) {
        out.docs[name] = record.docs?.[name] ?? `(no ${name} document in this blueprint)`;
      }
      return text(out);
    },
  },

  {
    name: "rancang_execution_prompt",
    title: "Get the execution prompt",
    description:
      "Build the ready-to-run prompt that turns a finished blueprint into work: working instructions plus the requested documents inline. Paste it as the first message to a coding agent, or read it yourself and start executing. This is the main tool of this server.",
    inputSchema: {
      type: "object",
      properties: {
        id: ID_SCHEMA,
        agent: {
          type: "string",
          description:
            'Who will execute it, e.g. "Claude Code", "Cursor", "Codex". Used in the prompt wording.',
        },
        working_dir: {
          type: "string",
          description:
            "Absolute path of the project the agent should build in. Omit if not decided yet.",
        },
        include: {
          type: "array",
          items: DOC_ENUM,
          description:
            "Which documents to inline. Defaults to all four; drop `prd` to save context.",
        },
      },
      additionalProperties: false,
    },
    handler: ({ id, agent, working_dir, include }) => {
      const record = resolveBlueprint(id);
      if (!record) throw new Error(`Blueprint not found: ${id ?? "latest"}`);
      return text(buildExecutionPrompt(record, { agent, working_dir, include }));
    },
  },

  {
    name: "rancang_next_task",
    title: "Get the next task",
    description:
      "Return the next unfinished task from the blueprint's tasks.md, plus the remaining queue and overall progress (done/total). Call this after finishing each task to stay on track.",
    inputSchema: {
      type: "object",
      properties: { id: ID_SCHEMA },
      additionalProperties: false,
    },
    handler: ({ id }) => {
      const result = nextTask(id);
      if (!result.next) {
        return text({
          id: result.id,
          title: result.title,
          summary: result.summary,
          message:
            "All tasks are complete. Run the blueprint's verification section end to end.",
        });
      }
      return text(result);
    },
  },

  {
    name: "rancang_task_complete",
    title: "Mark a task complete",
    description:
      'Tick a task off in the stored tasks.md (e.g. task_id "T012"). Call this only after the task is actually implemented AND verified with a real command — not when you intend to do it.',
    inputSchema: {
      type: "object",
      properties: {
        id: ID_SCHEMA,
        task_id: { type: "string", description: 'Task id from tasks.md, e.g. "T012".' },
        done: {
          type: "boolean",
          description: "Set false to reopen the task. Defaults to true.",
        },
      },
      required: ["task_id"],
      additionalProperties: false,
    },
    handler: ({ id, task_id, done }) => {
      const result = completeTask(id, task_id, done !== false);
      return text({
        id: result.id,
        marked: `${result.taskId} -> ${result.done ? "done" : "pending"}`,
        progress: summarizeTasks(
          result.tasks.map((t) => `${t.done ? "- [x]" : "- [ ]"} ${t.id}`).join("\n")
        ),
        next_task: result.tasks.find((t) => !t.done) ?? null,
      });
    },
  },

  {
    name: "rancang_save_blueprint",
    title: "Save a blueprint",
    description:
      "Save or update a blueprint from outside the web app — e.g. an agent writing revisions back to Rancang. Provide `id` to update in place, omit it to create a new one.",
    inputSchema: {
      type: "object",
      properties: {
        id: ID_SCHEMA,
        title: { type: "string" },
        idea: { type: "string", description: "The original idea this blueprint came from." },
        model: { type: "string" },
        docs: {
          type: "object",
          additionalProperties: { type: "string" },
          description:
            "Markdown content per document, keyed by prd/spec/plan/tasks. At least one is required.",
        },
        source: { type: "string", description: 'Origin of the write, e.g. "mcp" or "web".' },
        working_dir: {
          type: "string",
          description: "Absolute path of the project this blueprint targets, if known.",
        },
      },
      required: ["docs"],
      additionalProperties: false,
    },
    handler: (args) => {
      const record = saveBlueprint({ ...args, source: args.source || "mcp" });
      return text({
        id: record.id,
        title: record.title,
        docs: DOC_NAMES.filter((d) => record.docs?.[d]),
        updatedAt: record.updatedAt,
      });
    },
  },

  {
    name: "rancang_status",
    title: "Rancang status",
    description:
      "Quick health check: where blueprints are stored, how many exist, and what the latest one is. Useful when nothing shows up.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: () => {
      const items = listBlueprints();
      return text({
        home: rancangHome(),
        blueprint_dir: blueprintDir(),
        count: items.length,
        latest: items[0]
          ? { id: items[0].id, title: items[0].title, tasks: items[0].tasks }
          : null,
        latest_raw: latestBlueprint()?.id ?? null,
      });
    },
  },
];

/**
 * Register every tool above on a connected Server instance.
 * Schemas go out verbatim as JSON Schema (see the note at the top of this file).
 */
export async function registerTools(server, { CallToolRequestSchema, ListToolsRequestSchema }) {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map((t) => ({
      name: t.name,
      title: t.title,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const found = TOOLS.find((t) => t.name === request.params.name);
    if (!found) return fail(new Error(`Unknown tool: ${request.params.name}`));
    try {
      const args = checkArgs(found.inputSchema, request.params.arguments);
      return await found.handler(args);
    } catch (err) {
      return fail(err);
    }
  });
}

export {
  DOC_NAMES,
  saveBlueprint,
  resolveBlueprint,
  buildExecutionPrompt,
  nextTask,
  completeTask,
  listBlueprints,
  readBlueprint,
  summarizeTasks,
};
