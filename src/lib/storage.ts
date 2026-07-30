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

export type PlanRecord = {
  id: string;
  title: string;
  idea: string;
  markdown: string;
  createdAt: number;
};

const CHAT_KEY = "prd-forge:conversations";
const PLAN_KEY = "prd-forge:plans";
const PLAN_LIMIT = 5;

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
  all: () => read<Conversation>(CHAT_KEY).sort((a, b) => b.createdAt - a.createdAt),
  save: (conversation: Conversation) => {
    const all = read<Conversation>(CHAT_KEY);
    const idx = all.findIndex((c) => c.id === conversation.id);
    if (idx >= 0) all[idx] = conversation;
    else all.push(conversation);
    write(CHAT_KEY, all);
  },
  remove: (id: string) => {
    write(CHAT_KEY, read<Conversation>(CHAT_KEY).filter((c) => c.id !== id));
  },
};

export const planStore = {
  all: () => read<PlanRecord>(PLAN_KEY).sort((a, b) => b.createdAt - a.createdAt),
  save: (plan: PlanRecord) => {
    const all = read<PlanRecord>(PLAN_KEY).filter((p) => p.id !== plan.id);
    all.unshift(plan);
    write(PLAN_KEY, all.slice(0, PLAN_LIMIT));
  },
};
