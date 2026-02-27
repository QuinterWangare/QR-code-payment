import { NextRequest, NextResponse } from "next/server";
import { getAndDeletePaymentResult } from "../payment-store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { checkoutRequestId } = body;

    // Fast path: the M-Pesa callback fires almost instantly when the user
    // cancels, enters the wrong PIN, or completes the payment. Check the
    // callback-populated store first so we don't wait an extra 5 s poll cycle.
    if (checkoutRequestId) {
      const callbackResult = getAndDeletePaymentResult(checkoutRequestId);
      if (callbackResult) {
        console.log("[stkquery] ⚡ Resolved from callback store:", callbackResult.status, callbackResult.reason ?? "");
        return NextResponse.json(callbackResult);
      }
    }

    // Fallback: query Safaricom directly via the backend
    const backendRes = await fetch(`${process.env.BACKEND_URL}/api/stkquery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch {
    return NextResponse.json({ status: "pending" }, { status: 200 });
  }
}
