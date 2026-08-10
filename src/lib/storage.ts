export type ChatMessageRecord = {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
};

export type Conversation = {
  id: string;
  title: string;
  createdAt: number;
  messages: ChatMessageRecord[];
};

export type PlanVersion = {
  id: string;
  markdown: string;
  createdAt: number;
  source: "generated" | "manual-edit" | "ai-edit";
  note?: string;
};

export type PlanRecord = {
  id: string;
  title: string;
  idea: string;
  markdown: string;
  createdAt: number;
  versions: PlanVersion[];
};

const PLAN_LIMIT = 5;

// Storage is namespaced per identity so anonymous and logged-in users (and different
// logged-in users sharing a browser) never see each other's chats/plans. Scope defaults
// to "anon" until auth-provider calls setStorageScope(uid) after Firebase resolves.
let scope = "anon";

export function setStorageScope(uid: string | null) {
  scope = uid ?? "anon";
}

function chatKey() {
  return `prd-forge:${scope}:conversations`;
}
function planKey() {
  return `prd-forge:${scope}:plans`;
}

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, value: T[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export const conversationStore = {
  all: () => read<Conversation>(chatKey()).sort((a, b) => b.createdAt - a.createdAt),
  save: (conversation: Conversation) => {
    const all = read<Conversation>(chatKey());
    const idx = all.findIndex((c) => c.id === conversation.id);
    if (idx >= 0) all[idx] = conversation;
    else all.push(conversation);
    write(chatKey(), all);
  },
  remove: (id: string) => {
    write(chatKey(), read<Conversation>(chatKey()).filter((c) => c.id !== id));
  },
};

// Old localStorage records predate the `versions` field; synthesize a single
// v1 entry from markdown/createdAt so they load without crashing.
function migratePlan(p: PlanRecord & { versions?: PlanVersion[] }): PlanRecord {
  if (p.versions && p.versions.length > 0) return p as PlanRecord;
  return {
    ...p,
    versions: [{ id: `${p.id}-v1`, markdown: p.markdown, createdAt: p.createdAt, source: "generated" }],
  };
}

export const planStore = {
  all: () => read<PlanRecord>(planKey()).map(migratePlan).sort((a, b) => b.createdAt - a.createdAt),
  save: (plan: PlanRecord) => {
    const all = read<PlanRecord>(planKey()).map(migratePlan).filter((p) => p.id !== plan.id);
    all.unshift(plan);
    write(planKey(), all.slice(0, PLAN_LIMIT));
  },
};
