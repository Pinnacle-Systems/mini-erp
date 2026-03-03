export const successResponse = <TPayload extends Record<string, unknown> = Record<string, never>>(
  payload?: TPayload,
) => ({
  success: true as const,
  ...(payload ?? ({} as TPayload)),
});
