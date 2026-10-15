export interface TaskItem {
  id: string;
  text: string;
  done: boolean;
  phase: string;
}

export interface TaskSummary {
  total: number;
  done: number;
  pending: number;
}

export interface BlueprintItem {
  id: string;
  title: string;
  idea: string;
  model: string;
  createdAt: number;
  updatedAt: number;
  source: string;
  docs: string[];
  tasks: TaskSummary;
}

export interface BlueprintDetail {
  blueprintId: string;
  title: string;
  summary: TaskSummary;
  tasks: TaskItem[];
  next: TaskItem | null;
}

export interface TaskPromptResult {
  ok: boolean;
  blueprintId: string;
  taskId: string;
  prompt: string;
}

export interface SearchResultItem {
  blueprintId: string;
  blueprintTitle: string;
  id: string;
  text: string;
  done: boolean;
  phase: string;
}

export interface ExecutionLogItem {
  taskId: string;
  action: "complete" | "reopen";
  timestamp: number;
}

export interface VersionItem {
  id: string;
  note: string;
  timestamp: number;
  summary: { total: number; done: number; pending: number } | null;
}

export type ExecTab = "opencode" | "claude-code" | "hermes" | "direct";

export function buildExecCommand(tab: ExecTab, id: string, title: string): string {
  switch (tab) {
    case "opencode":
      return `opencode prompt "Jalankan rancang_execution_prompt(blueprint_id=\\"${id}\\"). Ambil task pertama dengan rancang_next_task, implementasi + verifikasi, lalu rancang_task_complete. Ulangi sampai semua task selesai."`;
    case "claude-code":
      return `claude --prompt "Eksekusi blueprint ${id} (${title}). Gunakan MCP rancang_next_task → implement → rancang_task_complete. Semua task harus selesai."`;
    case "hermes":
      return `hermes mcp tool rancang rancang_execution_prompt blueprint_id="${id}"`;
    case "direct":
    default:
      return `cd <folder-proyek> && cat AGENTS.md`;
  }
}
