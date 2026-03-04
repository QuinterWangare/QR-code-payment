import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/payment-stream/[checkoutRequestId]
 *
 * Thin SSE proxy — forwards the backend's event stream straight to the browser
 * so the frontend receives payment results instantly without polling lag.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ checkoutRequestId: string }> },
) {
  const { checkoutRequestId } = await params;

  let backendRes: Response;
  try {
    backendRes = await fetch(
      `${process.env.BACKEND_URL}/api/payment-stream/${checkoutRequestId}`,
      { headers: { Accept: "text/event-stream" }, cache: "no-store" },
    );
  } catch {
    // Backend unreachable — return an empty 503 so the frontend falls back to polling.
    return new Response(null, { status: 503 });
  }

  return new Response(backendRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
