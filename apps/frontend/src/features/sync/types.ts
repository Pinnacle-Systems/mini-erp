export type SyncOperation = "create" | "update" | "delete" | "purge";

export type SyncRejectionReasonCode =
  | "VERSION_CONFLICT"
  | "VALIDATION_FAILED"
  | "PERMISSION_DENIED"
  | "DEPENDENCY_MISSING"
  | "ENTITY_IN_USE";

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

export type AppliedOutcomeEntity = {
  entity: string;
  entityId: string;
};

export type AppliedOutcome = {
  category: "mutation" | "hybrid_delete";
  summary: string;
  archived: AppliedOutcomeEntity[];
  purged: AppliedOutcomeEntity[];
  updated: AppliedOutcomeEntity[];
};

export type MutationAck =
  | {
      mutationId: string;
      status: "applied";
      outcome?: AppliedOutcome;
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

export type SyncResultRecord = {
  mutationId: string;
  entity: string;
  entityId: string;
  operation: SyncOperation;
  resultStatus: "applied" | "rejected";
  summary: string;
  processedAt: string;
  userId: string;
  outcome?: AppliedOutcome;
  rejection?: {
    reasonCode: SyncRejectionReasonCode;
    details?: Record<string, unknown>;
  };
};

export type SyncResultsResponse = {
  success: boolean;
  page: number;
  limit: number;
  total: number;
  results: SyncResultRecord[];
};
