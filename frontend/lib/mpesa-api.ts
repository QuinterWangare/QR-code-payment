/**
 * lib/mpesa-api.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Typed client for all M-Pesa API interactions.
 * UI components import from here — they never call fetch() directly.
 * This keeps network logic in one place and makes mocking easy for tests.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type StkPushRequest = {
  phone: string;       // E.164 format: "254XXXXXXXXX"
  amount: number;
  accountNumber?: string;
};

export type StkPushResponse =
  | { status: true;  checkoutRequestId: string; msg: string }
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
export async function initiateStkPush(payload: StkPushRequest): Promise<StkPushResponse> {
  const res = await fetch("/api/stkpush", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok || !data.status) {
    return {
      status: false,
      msg: data.msg || "Payment initiation failed. Please try again.",
      reason: data.reason,
    };
  }

  return {
    status: true,
    checkoutRequestId: data.checkoutRequestId,
    msg: data.msg,
  };
}

/**
 * Query the current status of an STK Push transaction.
 * Safe to call repeatedly — returns "pending" on transient network errors
 * so the polling loop can continue.
 */
export async function queryStkStatus(checkoutRequestId: string): Promise<StkQueryResponse> {
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
