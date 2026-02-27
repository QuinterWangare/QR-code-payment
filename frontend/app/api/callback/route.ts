import { NextRequest, NextResponse } from "next/server";
import { setPaymentResult } from "../payment-store";

// Maps Safaricom ResultCode → reason string (must match payment-failed page configs)
const CALLBACK_REASON_MAP: Record<number, string> = {
  1: "insufficient_balance",
  2: "below_minimum",
  3: "above_maximum",
  4: "daily_limit",
  5: "below_min_balance",
  6: "invalid_sender",
  7: "invalid_receiver",
  11: "invalid_account",
  17: "internal_error",
  1001: "subscriber_locked",
  1025: "duplicate_transaction",
  1031: "duplicate_transaction",
  1032: "cancelled",
  1037: "timeout",
  2001: "wrong_pin",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("M-Pesa STK Callback received:", JSON.stringify(body, null, 2));

    const stkCallback = body?.Body?.stkCallback;
    if (!stkCallback) {
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const checkoutRequestId = stkCallback.CheckoutRequestID;
    const resultCode = stkCallback.ResultCode;
    const resultDesc = stkCallback.ResultDesc;

    if (resultCode === 0) {
      const metadata = stkCallback.CallbackMetadata?.Item || [];
      const amount = metadata.find((i: any) => i.Name === "Amount")?.Value;
      const receiptNumber = metadata.find(
        (i: any) => i.Name === "MpesaReceiptNumber",
      )?.Value;
      const phone = metadata.find((i: any) => i.Name === "PhoneNumber")?.Value;
      setPaymentResult(checkoutRequestId, {
        status: "success",
        amount,
        receiptNumber,
        phone,
      });
      console.log("✅ Callback — payment successful:", {
        checkoutRequestId,
        amount,
        receiptNumber,
      });
    } else {
      const reason = CALLBACK_REASON_MAP[resultCode] ?? "failed";
      setPaymentResult(checkoutRequestId, {
        status: "failed",
        message: resultDesc,
        reason,
      });
      console.log(`❌ Payment failed [${resultCode}] reason=${reason}:`, resultDesc);
    }

    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error) {
    console.error("Callback error:", error);
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
}
