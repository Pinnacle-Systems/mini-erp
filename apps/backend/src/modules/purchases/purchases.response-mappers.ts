import { successResponse } from "../../shared/http/response-mappers.js";

export const toPurchaseDocumentListView = (documents: unknown[]) =>
  successResponse({
    documents,
  });

export const toPurchaseDocumentPayload = (document: unknown) =>
  successResponse({
    document,
  });

export const toPurchaseDocumentHistoryView = (history: unknown[]) =>
  successResponse({
    history,
  });

export const toPurchaseConversionBalanceView = (lines: unknown[]) =>
  successResponse({
    lines,
  });

export const toPurchaseOverviewView = (overview: Record<string, unknown>) =>
  successResponse(overview);
