import { successResponse } from "../../shared/http/response-mappers.js";
import { catchAsync } from "../../shared/utils/catchAsync.js";

export const recordClientDiagnostic = catchAsync(async (req, res) => {
  const { category, level, event, details } = req.body as {
    category: string;
    level: string;
    event: string;
    details: Record<string, unknown>;
  };

  console.warn("[client-diagnostic]", {
    category,
    level,
    event,
    details,
    receivedAt: new Date().toISOString(),
  });

  res.status(202).json(successResponse());
});
