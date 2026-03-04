import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const backendRes = await fetch(`${process.env.BACKEND_URL}/api/stkpush`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    // Safely parse JSON — some error responses (e.g. 503 from a proxy) may not
    // be valid JSON, so fall back to a generic error shape.
    let data: Record<string, unknown>;
    try {
      data = await backendRes.json();
    } catch {
      data = {
        status: false,
        reason: "service_unavailable",
        msg: "M-Pesa service is temporarily unavailable. Please try again.",
      };
    }

    return NextResponse.json(data, { status: backendRes.status });
  } catch (error) {
    console.error("[stkpush proxy] Failed to reach backend:", error);
    return NextResponse.json(
      {
        status: false,
        reason: "service_unavailable",
        msg: "Could not reach the payment server. Please check your connection and try again.",
      },
      { status: 503 },
    );
  }
}
