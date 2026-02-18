import { NextRequest, NextResponse } from "next/server";

const notFound = (req: NextRequest) =>
  NextResponse.json(
    {
      success: false,
      message: `Cannot ${req.method} ${req.nextUrl.pathname}`,
    },
    { status: 404 },
  );

export function GET(req: NextRequest) {
  return notFound(req);
}

export function POST(req: NextRequest) {
  return notFound(req);
}

export function PUT(req: NextRequest) {
  return notFound(req);
}

export function PATCH(req: NextRequest) {
  return notFound(req);
}

export function DELETE(req: NextRequest) {
  return notFound(req);
}

export function OPTIONS(req: NextRequest) {
  return notFound(req);
}

export function HEAD(req: NextRequest) {
  return notFound(req);
}
