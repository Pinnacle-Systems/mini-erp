import { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE } from "@/features/auth/server";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(ACCESS_TOKEN_COOKIE);
  response.cookies.delete("refreshToken");
  return response;
}
