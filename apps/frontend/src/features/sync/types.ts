export type SyncOperation = "create" | "update" | "delete";

export type SyncRejectionReasonCode =
  | "VERSION_CONFLICT"
  | "VALIDATION_FAILED"
  | "PERMISSION_DENIED"
  | "DEPENDENCY_MISSING";

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

export type SyncRejection = {
  mutationId: string;
  status: "rejected";
  reasonCode: SyncRejectionReasonCode;
  message: string;
  entity: string;
  entityId: string;
  details?: Record<string, unknown>;
};

export type MutationAck =
  | {
      mutationId: string;
      status: "applied";
    }
  | SyncRejection;

export type SyncDelta = {
  cursor: string;
  entity: string;
  entityId: string;
  op: SyncOperation;
  data: Record<string, unknown>;
  serverVersion: number;
  serverTimestamp: string;
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
