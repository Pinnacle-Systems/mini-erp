import type { MutationAck, SyncDelta, SyncMutation } from "../types";

const acceptedEntities = new Set(["product"]);

const nextCursor = () => Date.now().toString();

export const processMutations = async (mutations: SyncMutation[]) => {
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

export const getDeltasSinceCursor = async (_cursor: string, _limit: number) => {
  const deltas: SyncDelta[] = [];

  return {
    nextCursor: nextCursor(),
    deltas,
  };
};
