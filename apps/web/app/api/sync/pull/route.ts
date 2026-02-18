import { NextRequest, NextResponse } from "next/server";
import { pullQuerySchema } from "@/features/sync/schemas";
import { getDeltasSinceCursor } from "@/features/sync/server";
import { ACCESS_TOKEN_COOKIE, readAccessToken } from "@/features/auth/server";
import { tenantService } from "@/features/tenant/server";
import { SystemRole } from "@/generated/prisma/enums";

export async function GET(req: NextRequest) {
  try {
    const query = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = pullQuerySchema.safeParse(query);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid sync pull query",
          issues: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    const token = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
    if (!token) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const payload = await readAccessToken(token);
    if (
      !payload ||
      payload.systemRole !== SystemRole.USER ||
      typeof payload.sub !== "string"
    ) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const member = await tenantService.validateMembership(payload.sub, parsed.data.tenantId);
    if (!member) {
      return NextResponse.json({ success: false, message: "Access denied" }, { status: 403 });
    }

    const result = await getDeltasSinceCursor(
      parsed.data.tenantId,
      parsed.data.cursor,
      parsed.data.limit,
    );

    return NextResponse.json({
      success: true,
      nextCursor: result.nextCursor,
      deltas: result.deltas,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
      },
      { status: 500 },
    );
  }
}
