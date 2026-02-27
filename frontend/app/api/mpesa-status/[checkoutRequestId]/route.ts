import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ checkoutRequestId: string }> },
) {
  const { checkoutRequestId } = await params;
  try {
    const res = await fetch(
      `${process.env.BACKEND_URL}/api/mpesa-status/${encodeURIComponent(checkoutRequestId)}`,
    );
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ status: "pending" });
  }
}
