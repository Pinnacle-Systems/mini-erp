import type { MutationAck, SyncDelta, SyncMutation } from "../types";

const acceptedEntities = new Set(["item"]);

const nextCursor = () => Date.now().toString();

export const processMutations = async (
  tenantId: string,
  mutations: SyncMutation[],
) => {
  void tenantId;
  const acknowledgements: MutationAck[] = mutations.map((mutation) => {
    if (!acceptedEntities.has(mutation.entity)) {
      return {
        mutationId: mutation.mutationId,
        status: "rejected",
        reason: `Unsupported entity '${mutation.entity}'`,
      };
    }

    return {
      mutationId: mutation.mutationId,
      status: "applied",
    };
  });

  return {
    cursor: nextCursor(),
    acknowledgements,
  };
};

export const getDeltasSinceCursor = async (
  tenantId: string,
  cursor: string,
  limit: number,
) => {
  void tenantId;
  void cursor;
  void limit;
  const deltas: SyncDelta[] = [];

  return {
    nextCursor: nextCursor(),
    deltas,
  };
};
