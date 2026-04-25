import { afterEach, describe, expect, it, vi } from "vitest";
import { ZodError, z } from "zod";
import { globalErrorHandler } from "./error.middleware.js";
import { UnauthorizedError } from "../utils/errors.js";

const createResponse = () => {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status: vi.fn((statusCode: number) => {
      res.statusCode = statusCode;
      return res;
    }),
    json: vi.fn((body: unknown) => {
      res.body = body;
      return res;
    }),
  };

  return res;
};

describe("globalErrorHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not expose stack traces for unexpected errors", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = createResponse();
    const err = new Error(
      "Invalid `prisma.identity.findFirst()` invocation in auth.service.ts:32:42",
    );

    globalErrorHandler(err, {}, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body).toEqual({
      success: false,
      status: "error",
      message: "Something went wrong. Please try again.",
    });
    expect(JSON.stringify(res.body)).not.toContain("prisma.identity.findFirst");
    expect(JSON.stringify(res.body)).not.toContain("stack");
    expect(consoleError).toHaveBeenCalledWith("ERROR", err);
  });

  it("keeps operational messages user-facing", () => {
    const res = createResponse();

    globalErrorHandler(new UnauthorizedError("Invalid credentials"), {}, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body).toMatchObject({
      success: false,
      status: "fail",
      message: "Invalid credentials",
    });
  });

  it("returns validation details without a stack trace", () => {
    const res = createResponse();
    const result = z.object({ phone: z.string().min(10) }).safeParse({ phone: "" });
    const err = result.error as ZodError;

    globalErrorHandler(err, {}, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toMatchObject({
      success: false,
      status: "error",
      message: "Validation failed",
    });
    expect(JSON.stringify(res.body)).not.toContain("stack");
  });
});
