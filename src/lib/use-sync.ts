"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { conversationStore, planStore, designStore, type Conversation, type PlanRecord, type DesignRecord } from "@/lib/storage";

export type SyncStatus = "idle" | "syncing" | "synced";

async function authedFetch(user: NonNullable<ReturnType<typeof useAuth>["user"]>, url: string, init?: RequestInit) {
  const token = await user.getIdToken();
  return fetch(url, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${token}` },
  });
}

/**
 * Syncs localStorage conversations/plans with Firestore when a user is logged in.
 * Anonymous users: no-op, storage.ts behaves exactly as before.
 */
export function useSync() {
  const { user } = useAuth();
  const [status, setStatus] = useState<SyncStatus>("idle");
  const migrated = useRef(false);

  useEffect(() => {
    if (!user) {
      migrated.current = false;
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        setStatus("syncing");

        // One-time migration: push whatever's in localStorage, skip dup ids handled by upsert.
        if (!migrated.current) {
          migrated.current = true;
          const localChats = conversationStore.all();
          const localPlans = planStore.all();
          const localDesigns = designStore.all();
          await Promise.all([
            ...localChats.map((c) => authedFetch(user, "/api/sync/chats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c) })),
            ...localPlans.map((p) => authedFetch(user, "/api/sync/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) })),
            ...localDesigns.map((d) => authedFetch(user, "/api/sync/designs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) })),
          ]);
        }

        // Merge Firestore into local view: Firestore wins on conflict by createdAt.
        const [chatsRes, plansRes, designsRes] = await Promise.all([
          authedFetch(user, "/api/sync/chats"),
          authedFetch(user, "/api/sync/plans"),
          authedFetch(user, "/api/sync/designs"),
        ]);
        if (chatsRes.ok) {
          const { chats } = (await chatsRes.json()) as { chats: Conversation[] };
          for (const remote of chats) {
            const local = conversationStore.all().find((c) => c.id === remote.id);
            if (!local || remote.createdAt >= local.createdAt) conversationStore.save(remote);
          }
        }
        if (plansRes.ok) {
          const { plans } = (await plansRes.json()) as { plans: PlanRecord[] };
          for (const remote of plans) {
            const local = planStore.all().find((p) => p.id === remote.id);
            if (!local || remote.createdAt >= local.createdAt) planStore.save(remote);
          }
        }
        if (designsRes.ok) {
          const { designs } = (await designsRes.json()) as { designs: DesignRecord[] };
          for (const remote of designs) {
            const local = designStore.all().find((d) => d.id === remote.id);
            if (!local || remote.createdAt >= local.createdAt) designStore.save(remote);
          }
        }

        if (!cancelled) setStatus("synced");
      } catch (err) {
        console.warn("[sync] initial sync failed", err);
        if (!cancelled) setStatus("idle");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const syncConversation = async (conversation: Conversation) => {
    if (!user) return;
    setStatus("syncing");
    try {
      const res = await authedFetch(user, "/api/sync/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(conversation),
      });
      setStatus(res.ok ? "synced" : "idle");
    } catch (err) {
      console.warn("[sync] chat sync failed", err);
      setStatus("idle");
    }
  };

  const syncPlan = async (plan: PlanRecord) => {
    if (!user) return;
    setStatus("syncing");
    try {
      const res = await authedFetch(user, "/api/sync/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(plan),
      });
      setStatus(res.ok ? "synced" : "idle");
    } catch (err) {
      console.warn("[sync] plan sync failed", err);
      setStatus("idle");
    }
  };

  const syncDesign = async (design: DesignRecord) => {
    if (!user) return;
    setStatus("syncing");
    try {
      const res = await authedFetch(user, "/api/sync/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(design),
      });
      setStatus(res.ok ? "synced" : "idle");
    } catch (err) {
      console.warn("[sync] design sync failed", err);
      setStatus("idle");
    }
  };

  const deleteConversation = async (id: string) => {
    if (!user) return;
    try {
      await authedFetch(user, `/api/sync/chats/${id}`, { method: "DELETE" });
    } catch (err) {
      console.warn("[sync] chat delete failed", err);
    }
  };

  const deleteDesignRemote = async (id: string) => {
    if (!user) return;
    try {
      await authedFetch(user, `/api/sync/designs/${id}`, { method: "DELETE" });
    } catch (err) {
      console.warn("[sync] design delete failed", err);
    }
  };

  return { status, syncConversation, syncPlan, syncDesign, deleteConversation, deleteDesignRemote, active: !!user };
}
