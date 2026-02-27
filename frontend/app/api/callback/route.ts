import { NextRequest, NextResponse } from "next/server";
import paymentResults from "../payment-store";

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
      paymentResults.set(checkoutRequestId, {
        status: "success",
        amount,
        receiptNumber,
        phone,
      });
      console.log("✅ Payment successful:", {
        checkoutRequestId,
        amount,
        receiptNumber,
      });
    } else {
      paymentResults.set(checkoutRequestId, {
        status: "failed",
        message: resultDesc,
      });
      console.log("❌ Payment failed:", resultDesc);
    }

    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error) {
    console.error("Callback error:", error);
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
}
