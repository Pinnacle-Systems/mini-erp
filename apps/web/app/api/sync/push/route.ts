import { NextRequest, NextResponse } from "next/server";
import { pushRequestSchema } from "@/features/sync/schemas";
import { processMutations } from "@/features/sync/server";

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

    const result = await processMutations(parsed.data.mutations);

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
