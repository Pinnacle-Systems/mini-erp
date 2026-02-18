import { NextRequest, NextResponse } from "next/server";
import { ZodType } from "zod";
import { AppError, BadRequestError } from "@/lib/http";

export const getClientIp = (req: NextRequest): string => {
  const forwardedFor = req.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }

  return req.headers.get("x-real-ip") ?? "unknown";
};

export const parseJsonBody = async <T>(req: NextRequest): Promise<T> => {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
};

export const parseAndValidateBody = async <T>(
  req: NextRequest,
  schema: ZodType<T>,
): Promise<T> => {
  const body = await parseJsonBody<unknown>(req);
  const parsedBody = schema.safeParse(body);

  if (!parsedBody.success) {
    const firstIssue = parsedBody.error.issues[0];
    throw new BadRequestError(firstIssue?.message ?? "Invalid input");
  }

  return parsedBody.data;
};

export const handleRouteError = (error: unknown): NextResponse => {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        success: false,
        message: error.message,
      },
      { status: error.statusCode },
    );
  }

  if (error instanceof SyntaxError) {
    const badRequestError = new BadRequestError("Invalid JSON body");

    return NextResponse.json(
      {
        success: false,
        message: badRequestError.message,
      },
      { status: badRequestError.statusCode },
    );
  }

  console.error(error);

  return NextResponse.json(
    {
      success: false,
      message: "Internal server error",
    },
    { status: 500 },
  );
};
