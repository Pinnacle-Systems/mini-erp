import { NextRequest, NextResponse } from "next/server";
import { pushRequestSchema } from "@/features/sync/schemas";
import { processMutations } from "@/features/sync/server";
import { ACCESS_TOKEN_COOKIE, readAccessToken } from "@/features/auth/server";
import { tenantService } from "@/features/tenant/server";
import { SystemRole } from "@/generated/prisma/enums";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = pushRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid sync push payload",
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

    const result = await processMutations(
      parsed.data.tenantId,
      parsed.data.mutations,
    );

    return NextResponse.json({
      success: true,
      cursor: result.cursor,
      acknowledgements: result.acknowledgements,
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
