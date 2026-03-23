import { z } from "zod";

const diagnosticsDetailSchema = z.record(z.string(), z.unknown());

export const clientDiagnosticsSchema = z.object({
  body: z.object({
    category: z.enum(["storage"]),
    level: z.enum(["info", "warning"]),
    event: z
      .string()
      .trim()
      .min(1, "Diagnostic event is required")
      .max(120, "Diagnostic event is too long"),
    details: diagnosticsDetailSchema,
  }),
  query: z.object({}),
  params: z.object({}),
});
