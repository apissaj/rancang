import { useEffect, useState, useCallback } from "react";
import {
  buildExecCommand,
  type BlueprintDetail,
  type BlueprintItem,
  type ExecTab,
  type ExecutionLogItem,
  type SearchResultItem,
  type TaskPromptResult,
  type VersionItem,
} from "@/lib/projects";

export function useProjects() {
  const [blueprints, setBlueprints] = useState<BlueprintItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expanded detail state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BlueprintDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<"list" | "dag">("list");

  // Per-task toggle state
  const [togglingTask, setTogglingTask] = useState<string | null>(null);

  // Command copy state
  const [cmdCopied, setCmdCopied] = useState<string | null>(null);
  const [execTab, setExecTab] = useState<ExecTab>("opencode");

  // Task prompt state
  const [promptTaskId, setPromptTaskId] = useState<string | null>(null);
  const [promptText, setPromptText] = useState<string | null>(null);
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);

  // Search state (multi-blueprint task search)
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultItem[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // History + versions state
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<ExecutionLogItem[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [versionsFor, setVersionsFor] = useState<string | null>(null);
  const [versionsData, setVersionsData] = useState<VersionItem[] | null>(null);
  const [versionsLoading, setVersionsLoading] = useState(false);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mcp/blueprint");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal memuat daftar blueprint");
        return;
      }
      setBlueprints(data.blueprints || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat blueprint dari server");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function loadDetail(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(id);
    setDetailLoading(true);
    setDetailTab("list");
    try {
      const res = await fetch(`/api/mcp/task?blueprintId=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (res.ok) {
        setDetail(data);
      }
    } catch (err) {
      console.error("[projects] failed to load task detail:", err);
    } finally {
      setDetailLoading(false);
    }
  }

  async function toggleTask(blueprintId: string, taskId: string, currentDone: boolean) {
    setTogglingTask(taskId);
    try {
      const res = await fetch("/api/mcp/task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blueprintId, taskId, done: !currentDone }),
      });
      const data = await res.json();
      if (res.ok && data.tasks) {
        setDetail((prev) =>
          prev ? { ...prev, tasks: data.tasks, summary: data.summary, next: data.next } : prev
        );
        setBlueprints((prev) =>
          prev.map((b) => (b.id === blueprintId ? { ...b, tasks: data.summary } : b))
        );
      }
    } catch (err) {
      console.error("[projects] toggle task failed:", err);
    } finally {
      setTogglingTask(null);
    }
  }

  async function fetchTaskPrompt(blueprintId: string, taskId: string) {
    if (promptTaskId === taskId) {
      setPromptTaskId(null);
      setPromptText(null);
      return;
    }
    setPromptTaskId(taskId);
    setPromptLoading(true);
    setPromptText(null);
    try {
      const res = await fetch(`/api/mcp/task/prompt?blueprintId=${encodeURIComponent(blueprintId)}&taskId=${encodeURIComponent(taskId)}`);
      const data: TaskPromptResult = await res.json();
      if (data.ok) {
        setPromptText(data.prompt);
      }
    } catch (err) {
      console.error("[projects] fetch task prompt failed:", err);
    } finally {
      setPromptLoading(false);
    }
  }

  const copyExecCmd = useCallback(
    (id: string, title: string) => {
      const cmd = buildExecCommand(execTab, id, title);
      navigator.clipboard.writeText(cmd);
      setCmdCopied(id);
      setTimeout(() => setCmdCopied(null), 2000);
    },
    [execTab]
  );

  async function runSearch() {
    const q = searchQuery.trim();
    if (!q) return;
    setSearchLoading(true);
    setSearchError(null);
    try {
      const res = await fetch(`/api/mcp/search?query=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search gagal");
      setSearchResults(data.results || []);
      if ((data.results || []).length === 0) {
        setSearchResults([]);
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search gagal");
    } finally {
      setSearchLoading(false);
    }
  }

  async function toggleHistory(blueprintId: string) {
    if (historyFor === blueprintId) {
      setHistoryFor(null);
      setHistoryData(null);
      return;
    }
    setHistoryFor(blueprintId);
    setHistoryLoading(true);
    setHistoryData(null);
    try {
      const res = await fetch(`/api/mcp/history?blueprint_id=${encodeURIComponent(blueprintId)}`);
      const data = await res.json();
      if (res.ok) setHistoryData(data.logs || []);
    } catch (err) {
      console.error("[projects] history failed:", err);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function toggleVersions(blueprintId: string) {
    if (versionsFor === blueprintId) {
      setVersionsFor(null);
      setVersionsData(null);
      return;
    }
    setVersionsFor(blueprintId);
    setVersionsLoading(true);
    setVersionsData(null);
    try {
      const res = await fetch(`/api/mcp/versions?blueprint_id=${encodeURIComponent(blueprintId)}`);
      const data = await res.json();
      if (res.ok) setVersionsData(data.versions || []);
    } catch (err) {
      console.error("[projects] versions failed:", err);
    } finally {
      setVersionsLoading(false);
    }
  }

  return {
    blueprints,
    loading,
    error,
    loadData,
    expandedId,
    detail,
    detailLoading,
    detailTab,
    setDetailTab,
    togglingTask,
    cmdCopied,
    execTab,
    setExecTab,
    promptTaskId,
    promptText,
    promptLoading,
    promptCopied,
    setPromptCopied,
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    searchLoading,
    searchError,
    runSearch,
    historyFor,
    historyData,
    historyLoading,
    versionsFor,
    versionsData,
    versionsLoading,
    loadDetail,
    toggleTask,
    fetchTaskPrompt,
    copyExecCmd,
    toggleHistory,
    toggleVersions,
  };
}

export type ProjectsController = ReturnType<typeof useProjects>;
