import { NextRequest, NextResponse } from "next/server";
import { pullQuerySchema } from "@/features/sync/schemas";
import { getDeltasSinceCursor } from "@/features/sync/server";

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

    const result = await getDeltasSinceCursor(parsed.data.cursor, parsed.data.limit);

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
