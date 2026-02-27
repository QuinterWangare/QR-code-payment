import { NextRequest, NextResponse } from "next/server";
import { getAndDeletePaymentResult } from "../../payment-store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ checkoutRequestId: string }> },
) {
  const { checkoutRequestId } = await params;
  const result = getAndDeletePaymentResult(checkoutRequestId);

  if (!result) {
    return NextResponse.json({ status: "pending" });
  }

  return NextResponse.json(result);
}
