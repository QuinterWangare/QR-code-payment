import { NextRequest, NextResponse } from "next/server";
import paymentResults from "../../payment-store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ checkoutRequestId: string }> },
) {
  const { checkoutRequestId } = await params;
  const result = paymentResults.get(checkoutRequestId);

  if (!result) {
    return NextResponse.json({ status: "pending" });
  }

  // Clean up after reading
  paymentResults.delete(checkoutRequestId);
  return NextResponse.json(result);
}
