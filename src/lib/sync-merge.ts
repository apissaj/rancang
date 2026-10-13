import type { PlanRecord } from "@/lib/storage";

export function shouldTakeRemote(local: Pick<PlanRecord, "createdAt"> | undefined, remote: Pick<PlanRecord, "createdAt">): boolean {
  return !local || remote.createdAt >= local.createdAt;
}

export function mergePlan(local: PlanRecord | undefined, remote: PlanRecord): PlanRecord {
  if (!local) return remote;
  if (!shouldTakeRemote(local, remote)) return local;
  return { ...remote, mcpId: local.mcpId ?? remote.mcpId };
}
