import fs from "fs";
import os from "os";
import path from "path";
import { resolveBlueprint, parseTasks } from "./mcp/store.mjs";

export interface BlueprintRecord {
  id: string;
  title?: string;
  idea?: string;
  model?: string;
  createdAt?: number;
  updatedAt?: number;
  source?: string;
  docs?: Record<string, string>;
}

/**
 * Directories a scaffold/sync request may touch. Defaults to the user's home
 * folder; override with RANCANG_ALLOWED_DIRS (path.delimiter-separated).
 */
export function allowedRoots(): string[] {
  const raw = process.env.RANCANG_ALLOWED_DIRS;
  const list = raw ? raw.split(path.delimiter) : [os.homedir()];
  return list.map((p) => path.resolve(p.trim())).filter(Boolean);
}

export function resolveAllowedDir(input: string): string {
  const resolved = path.resolve(input);
  const ok = allowedRoots().some((root) => {
    const rel = path.relative(root, resolved);
    return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
  });
  if (!ok) throw new Error(`Direktori di luar folder yang diizinkan: ${resolved}`);
  return resolved;
}

export interface ScaffoldOptions {
  blueprintId?: string;
  targetDir: string;
  format?: AgentFormat;
}

export type AgentFormat =
  | "agents"
  | "claude"
  | "codex"
  | "cursor"
  | "cline"
  | "windsurf"
  | "copilot"
  | "opencode"
  | "all";

export interface ScaffoldResult {
  success: boolean;
  targetDir: string;
  filesWritten: string[];
  blueprintId: string;
  title: string;
  totalTasks: number;
}

export const AGENT_FORMATS: { id: AgentFormat; label: string; file: string }[] = [
  { id: "agents", label: "AGENTS.md (universal)", file: "AGENTS.md" },
  { id: "claude", label: "Claude Code", file: "CLAUDE.md" },
  { id: "codex", label: "Codex", file: "AGENTS.md" },
  { id: "cursor", label: "Cursor", file: ".cursor/rules/rancang.mdc" },
  { id: "cline", label: "Cline", file: "CLINE.md" },
  { id: "windsurf", label: "Windsurf", file: ".windsurf/rules.md" },
  { id: "copilot", label: "GitHub Copilot", file: ".github/copilot-instructions.md" },
  { id: "opencode", label: "OpenCode", file: "opencode.md" },
];

interface TaskBrief {
  id: string;
  done: boolean;
  phase: string;
  text: string;
}

/** Shared context block used by every format. */
function contextBlock(bpl: BlueprintRecord, targetDir: string): string {
  const tasks = parseTasks(bpl.docs?.tasks || "") as TaskBrief[];
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  const pending = total - done;
  return [
    "- **Proyek:** " + (bpl.title || "Proyek Rancang"),
    "- **Konsep:** " + (bpl.idea || "-"),
    "- **Blueprint ID:** `" + bpl.id + "`",
    "- **Direktori:** `" + targetDir + "`",
    "- **Progress:** " + done + "/" + total + " task (" + pending + " pending)",
  ].join("\n");
}

function taskInstructions(bpl: BlueprintRecord, mcpNote: string): string {
  return `## Alur Kerja Task

1. **Ambil task berikutnya** — ${mcpNote}
2. **Kerjakan satu task** — implementasi nyata, tanpa placeholder/TODO palsu.
3. **Verifikasi** — jalankan typecheck/build/test, lampirkan output asli.
4. **Tandai selesai** — centang \`- [x]\` di \`TASKS.md\` atau panggil tool MCP.
5. **Ulangi** sampai semua task selesai.`;

}

function buildAgentsMd(bpl: BlueprintRecord, targetDir: string): string {
  const title = bpl.title || "Proyek Rancang";
  const idea = bpl.idea || "";
  const bplId = bpl.id;
  const tasks = parseTasks(bpl.docs?.tasks || "") as TaskBrief[];
  const totalTasks = tasks.length;

  return `# AGENTS.md — Instruksi Coding Proyek: ${title}

Dokumen ini adalah instruksi operasional untuk AI Coding Agent (OpenCode, Claude Code, Codex, Hermes, Cursor) yang mengerjakan proyek ini.

## Identitas Proyek & Blueprint
- **Nama Proyek:** ${title}
- **Konsep:** ${idea}
- **Blueprint ID:** \`${bplId}\`
- **Direktori:** \`${targetDir}\`
- **Total Task:** ${totalTasks} task

---

## Aturan Kerja Agent (WAJIB DIIKUTI)

1. **Gunakan MCP Rancang Jika Tersedia**
   Proyek ini terhubung ke MCP Rancang (\`http://127.0.0.1:3110/mcp\`).
   Jika tool MCP aktif di sesi Anda:
    - Gunakan \`rancang_next_task(id="${bplId}")\` untuk mengambil task yang sedang antre.
   - Selesaikan task tersebut, tulis kodenya, dan jalankan verifikasi/tes.
       - Panggil \`rancang_task_complete(id="${bplId}", task_id="<ID>")\` setelah diverifikasi tuntas.
    - Ulangi siklus ini hingga seluruh task berstatus selesai.

2. **Fallback Mode (Tanpa MCP)**
   Jika MCP Rancang tidak terdaftar di sesi Anda:
   - Baca dokumen blueprint lokal di \`.rancang/blueprint.json\` atau periksa daftar task di \`TASKS.md\`.
   - Ambil task berikutnya yang belum dicentang (\`- [ ]\`).
   - Kerjakan implementasi dan tes verifikasi.
   - Ubah checklist di \`TASKS.md\` menjadi (\`- [x]\`).

3. **Prinsip Implementasi Tuntas (No Slop / No Placeholders)**
   - JANGAN membuat kode placeholder, TODO palsu, atau fungsi mock tanpa implementasi.
   - Selalu jalankan typecheck (\`npm run typecheck\` atau \`npx tsc --noEmit\`) dan build/test sebelum menandai task selesai.
   - Ikuti aturan desain token dan tata letak di dokumen \`DESIGN.md\` jika ada.

---

## Alur Eksekusi Rekomendasi

\`\`\`bash
# 1. Pastikan dependencies terpasang
npm install

# 2. Cek task pertama
# Panggil tool MCP rancang_next_task atau lihat TASKS.md

# 3. Coding & verifikasi
# 4. Tandai selesai dan lanjut ke task berikutnya
\`\`\`
`;
}

function buildClaudeMd(bpl: BlueprintRecord, targetDir: string): string {
  return `# CLAUDE.md — Claude Code Instructions

Blueprint Rancang: **${bpl.title || "Proyek Rancang"}**

${contextBlock(bpl, targetDir)}

## Seputar Claude Code di proyek ini

Proyek ini dihasilkan oleh Rancang (prd-forge). Semua keputusan produk ada di dokumen:
- \`PRD.md\` — kontrak produk, goals, requirements, out-of-scope.
- \`SPEC.md\` — user stories & acceptance criteria (P1 = MVP).
- \`PLAN.md\` — arsitektur teknis, stack, struktur folder.
- \`TASKS.md\` — urutan pekerjaan, centang saat selesai.
- \`DESIGN.md\` — design system: token, UI rules, wireframes.

${taskInstructions(bpl, "gunakan \`rancang_next_task\` lalu \`rancang_task_complete\` via MCP Rancang (http://127.0.0.1:3110/mcp), atau baca TASKS.md")}

## MCP Rancang (opsional)
- Endpoint: \`http://127.0.0.1:3110/mcp\`
- Tool: \`rancang_next_task\`, \`rancang_task_complete\`, \`rancang_read_blueprint\`, \`rancang_execution_prompt\`.

Jangan pernah menyelesaikan task tanpa verifikasi nyata (build/test/typecheck). Jika task ambigu, tanya atau laporkan — jangan menebak.
`;
}

function buildCursorRules(bpl: BlueprintRecord, targetDir: string): string {
  return `---
description: Rancang blueprint — ${bpl.title || "Proyek Rancang"}
globs: **/*
alwaysApply: true
---

# Rancang Blueprint: ${bpl.title || "Proyek Rancang"}

${contextBlock(bpl, targetDir)}

Dokumen produk: PRD.md (kontrak), SPEC.md (user stories & P1), PLAN.md (arsitektur), TASKS.md (daftar kerja), DESIGN.md (design system).

${taskInstructions(bpl, "gunakan tool MCP rancang_next_task / rancang_task_complete, atau baca TASKS.md")}

## Aturan
- Implementasi nyata — dilarang placeholder, TODO palsu, fungsi mock.
- Verifikasi dengan perintah nyata sebelum menandai task selesai.
- Ikuti DESIGN.md untuk token, warna, tipografi, dan layout.
`;
}

function buildClineMd(bpl: BlueprintRecord, targetDir: string): string {
  return `# CLINE.md — Cline Instructions

Blueprint Rancang: **${bpl.title || "Proyek Rancang"}**

${contextBlock(bpl, targetDir)}

## Dokumen Proyek
- \`PRD.md\` — kontrak produk.
- \`SPEC.md\` — user stories, acceptance criteria.
- \`PLAN.md\` — arsitektur & stack.
- \`TASKS.md\` — checklist pekerjaan.
- \`DESIGN.md\` — design system & wireframes.

${taskInstructions(bpl, "gunakan MCP rancang (http://127.0.0.1:3110/mcp) atau edit TASKS.md langsung")}

## Prinsip
- Kerjakan task satu per satu, urut dari atas.
- JANGAN tinggalkan placeholder / TODO kosong.
- Verifikasi dengan perintah nyata (typecheck/build/test).
`;
}

function buildWindsurfRules(bpl: BlueprintRecord, targetDir: string): string {
  return `# Windsurf Rules — ${bpl.title || "Proyek Rancang"}

${contextBlock(bpl, targetDir)}

## Dokumen yang Harus Dibaca
- PRD.md → kontrak produk
- SPEC.md → P1 user story (MVP)
- PLAN.md → arsitektur & stack
- TASKS.md → urutan kerja
- DESIGN.md → design system

${taskInstructions(bpl, "gunakan rancang_next_task / rancang_task_complete via MCP (:3110) atau update TASKS.md")}

## Larangan
- No placeholder, no stub, no fabricated output.
- No lompat task — ikuti urutan TASKS.md.
- Verifikasi tiap task dengan perintah nyata.
`;
}

function buildCopilotInstructions(bpl: BlueprintRecord, targetDir: string): string {
  return `# GitHub Copilot Instructions — ${bpl.title || "Proyek Rancang"}

${contextBlock(bpl, targetDir)}

Saat membantu coding di repositori ini, ikuti blueprint Rancang:

1. Baca \`PRD.md\`, \`SPEC.md\`, \`PLAN.md\`, \`TASKS.md\`, \`DESIGN.md\` sebelum menulis kode.
2. Kerjakan task sesuai urutan di \`TASKS.md\`; jangan kerjakan di luar scope.
3. Patuhi design system di \`DESIGN.md\` (token warna, tipografi, spacing).
4. Selalu tulis implementasi nyata — tidak ada placeholder, stub, atau TODO.
5. Setelah selesai, centang task di \`TASKS.md\`.

## Konvensi
- TypeScript strict. Jalankan \`npx tsc --noEmit\` sebelum menganggap selesai.
- Komponen UI pakai pattern yang sudah ada; jangan duplikasi.
`;
}

function buildOpenCodeMd(bpl: BlueprintRecord, targetDir: string): string {
  return `# OpenCode Instructions — ${bpl.title || "Proyek Rancang"}

${contextBlock(bpl, targetDir)}

## MCP Rancang
OpenCode terhubung ke MCP Rancang (\`http://127.0.0.1:3110/mcp\`). Gunakan:
- \`rancang_next_task\` — ambil task berikutnya.
- \`rancang_task_complete\` — tandai selesai setelah verifikasi.

## Dokumen
PRD.md, SPEC.md, PLAN.md, TASKS.md, DESIGN.md — baca sesuai kebutuhan.

${taskInstructions(bpl, "panggil tool MCP rancang_next_task")}

## Aturan
- Satu task per sesi kerja; verifikasi nyata; laporkan \`[task-id] done — bukti\`.
`;
}

/**
 * Scaffolds project files into the user-specified target directory.
 * Writes blueprint docs + agent instructions in the chosen format (or all formats).
 */
export async function scaffoldProject(options: ScaffoldOptions): Promise<ScaffoldResult> {
  const { blueprintId, targetDir, format } = options;
  if (!targetDir) {
    throw new Error("Target directory harus diisi");
  }

  // Resolve blueprint
  const bpl = resolveBlueprint(blueprintId || "latest") as BlueprintRecord | null;
  if (!bpl) {
    throw new Error(`Blueprint tidak ditemukan: ${blueprintId || "latest"}`);
  }

  const resolvedDir = resolveAllowedDir(targetDir);
  if (!fs.existsSync(resolvedDir)) {
    fs.mkdirSync(resolvedDir, { recursive: true });
  }

  const filesWritten: string[] = [];

  // 1. Write agent instructions file(s).
  //    Default ("agents") = AGENTS.md; "all" = every format.
  const formatsToWrite: AgentFormat[] =
    format === "all"
      ? AGENT_FORMATS.map((f) => f.id)
      : [format || "agents"];

  for (const fmt of formatsToWrite) {
    const spec = AGENT_FORMATS.find((f) => f.id === fmt);
    if (!spec) continue;
    let content: string;
    switch (fmt) {
      case "claude": content = buildClaudeMd(bpl, resolvedDir); break;
      case "cursor": content = buildCursorRules(bpl, resolvedDir); break;
      case "cline": content = buildClineMd(bpl, resolvedDir); break;
      case "windsurf": content = buildWindsurfRules(bpl, resolvedDir); break;
      case "copilot": content = buildCopilotInstructions(bpl, resolvedDir); break;
      case "opencode": content = buildOpenCodeMd(bpl, resolvedDir); break;
      case "codex": content = buildAgentsMd(bpl, resolvedDir); break;
      case "agents":
      default: content = buildAgentsMd(bpl, resolvedDir); break;
    }
    const p = path.join(resolvedDir, spec.file);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content, "utf8");
    filesWritten.push(spec.file);
  }

  // 2. Write local .rancang/blueprint.json
  const dotRancangDir = path.join(resolvedDir, ".rancang");
  if (!fs.existsSync(dotRancangDir)) {
    fs.mkdirSync(dotRancangDir, { recursive: true });
  }
  const bplJsonPath = path.join(dotRancangDir, "blueprint.json");
  fs.writeFileSync(bplJsonPath, JSON.stringify(bpl, null, 2), "utf8");
  filesWritten.push(".rancang/blueprint.json");

  // 3. Write individual docs if present
  if (bpl.docs) {
    if (bpl.docs.prd) {
      fs.writeFileSync(path.join(resolvedDir, "PRD.md"), bpl.docs.prd, "utf8");
      filesWritten.push("PRD.md");
    }
    if (bpl.docs.spec) {
      fs.writeFileSync(path.join(resolvedDir, "SPEC.md"), bpl.docs.spec, "utf8");
      filesWritten.push("SPEC.md");
    }
    if (bpl.docs.plan) {
      fs.writeFileSync(path.join(resolvedDir, "PLAN.md"), bpl.docs.plan, "utf8");
      filesWritten.push("PLAN.md");
    }
    if (bpl.docs.tasks) {
      fs.writeFileSync(path.join(resolvedDir, "TASKS.md"), bpl.docs.tasks, "utf8");
      filesWritten.push("TASKS.md");
    }
    if (bpl.docs.design) {
      fs.writeFileSync(path.join(resolvedDir, "DESIGN.md"), bpl.docs.design, "utf8");
      filesWritten.push("DESIGN.md");
    }
  }

  const tasks = parseTasks(bpl.docs?.tasks || "");

  return {
    success: true,
    targetDir: resolvedDir,
    filesWritten,
    blueprintId: bpl.id,
    title: bpl.title || "Proyek Rancang",
    totalTasks: tasks.length,
  };
}

// Re-export so the API route can inspect available formats.
export { buildAgentsMd };