import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  handleRouteError,
  verifyAccessToken,
} from "@/features/auth/server";
import { UnauthorizedError } from "@/lib/http";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

    if (!token) {
      throw new UnauthorizedError("Unauthorized");
    }

    const isTokenValid = await verifyAccessToken(token);
    if (!isTokenValid) {
      throw new UnauthorizedError("Unauthorized");
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    const response = handleRouteError(error);
    if (error instanceof UnauthorizedError) {
      response.cookies.delete(ACCESS_TOKEN_COOKIE);
    }
    return response;
  }
}
