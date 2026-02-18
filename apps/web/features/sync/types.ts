export type SyncOperation = "create" | "update" | "delete";

export type SyncMutation = {
  mutationId: string;
  deviceId: string;
  userId: string;
  entity: string;
  entityId: string;
  op: SyncOperation;
  payload: Record<string, unknown>;
  baseVersion?: number;
  clientTimestamp: string;
};

export type MutationAck = {
  mutationId: string;
  status: "applied" | "rejected";
  reason?: string;
};

export type SyncDelta = {
  cursor: string;
  entity: string;
  entityId: string;
  op: SyncOperation;
  data: Record<string, unknown>;
  serverVersion: number;
  serverTimestamp: string;
};

export type PushRequest = {
  tenantId: string;
  mutations: SyncMutation[];
};

export type PushResponse = {
  success: boolean;
  cursor: string;
  acknowledgements: MutationAck[];
};

export type PullResponse = {
  success: boolean;
  nextCursor: string;
  deltas: SyncDelta[];
};
