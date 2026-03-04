/**
 * lib/mpesa-api.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Typed client for all M-Pesa API interactions.
 * UI components import from here — they never call fetch() directly.
 * This keeps network logic in one place and makes mocking easy for tests.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type StkPushRequest = {
  phone: string; // E.164 format: "254XXXXXXXXX"
  amount: number;
  accountNumber?: string;
};

export type StkPushResponse =
  | { status: true; checkoutRequestId: string; msg: string }
  | { status: false; msg: string; reason?: string };

export type StkQueryResponse =
  | { status: "success" }
  | { status: "pending" }
  | { status: "failed"; reason: string; message: string };

// ─── Client ───────────────────────────────────────────────────────────────────

/**
 * Initiate an M-Pesa STK Push prompt on the customer's phone.
 * Throws on network error; returns a typed discriminated union otherwise.
 */
export async function initiateStkPush(
  payload: StkPushRequest,
): Promise<StkPushResponse> {
  const res = await fetch("/api/stkpush", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  // Safely parse the response — a proxy/gateway error may return non-JSON.
  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    // Response body was not JSON (e.g. gateway HTML error page).
    // Fall through with empty data; the status check below will handle it.
  }

  if (!res.ok || !data.status) {
    // Map HTTP 503 to a user-friendly reason when the backend didn't provide one.
    const reason =
      (data.reason as string | undefined) ??
      (res.status === 503 || res.status === 502 || res.status === 504
        ? "service_unavailable"
        : undefined);

    return {
      status: false,
      msg:
        (data.msg as string | undefined) ||
        "Payment initiation failed. Please try again.",
      reason,
    };
  }

  return {
    status: true,
    checkoutRequestId: data.checkoutRequestId as string,
    msg: data.msg as string,
  };
}

/**
 * Query the current status of an STK Push transaction.
 * Safe to call repeatedly — returns "pending" on transient network errors
 * so the polling loop can continue.
 */
export async function queryStkStatus(
  checkoutRequestId: string,
): Promise<StkQueryResponse> {
  try {
    const res = await fetch("/api/stkquery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkoutRequestId }),
    });

    const data: StkQueryResponse = await res.json();
    return data;
  } catch {
    // Network / parse error — treat as pending to keep polling alive
    return { status: "pending" };
  }
}

/**
 * Open a Server-Sent Events connection to receive the payment result the
 * instant the M-Pesa callback arrives on the backend.
 *
 * Returns an unsubscribe function — call it to close the connection.
 * Falls back gracefully to polling if SSE fails or is unsupported.
 */
export function subscribeToPaymentResult(
  checkoutRequestId: string,
  onResult: (result: StkQueryResponse) => void,
): () => void {
  if (typeof EventSource === "undefined") return () => {}; // SSR guard

  const es = new EventSource(`/api/payment-stream/${checkoutRequestId}`);

  es.onmessage = (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data as string) as { type: string } & StkQueryResponse;
      if (data.type === "result") {
        onResult(data);
        es.close();
      }
    } catch { /* ignore malformed frames */ }
  };

  // On error just close — polling loop continues as fallback.
  es.onerror = () => es.close();

  return () => es.close();
}
