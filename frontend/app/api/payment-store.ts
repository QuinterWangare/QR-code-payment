// Module-level Map persists across requests in the same Next.js server process.
// Each entry has a TTL so the Map cannot grow unboundedly in production.

const ENTRY_TTL_MS = 15 * 60 * 1000; // 15 minutes

type PaymentResult = {
  status: "success" | "failed";
  amount?: number;
  receiptNumber?: string;
  phone?: string;
  message?: string;
  reason?: string;
  expiresAt: number; // Unix timestamp in ms
};

const paymentResults = new Map<string, PaymentResult>();

// Prune expired entries every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [key, value] of paymentResults.entries()) {
      if (value.expiresAt < now) {
        paymentResults.delete(key);
      }
    }
  },
  5 * 60 * 1000,
);

/** Store a result with automatic expiry. */
export function setPaymentResult(
  checkoutRequestId: string,
  result: Omit<PaymentResult, "expiresAt">,
): void {
  paymentResults.set(checkoutRequestId, {
    ...result,
    expiresAt: Date.now() + ENTRY_TTL_MS,
  });
}

/** Read and remove a result. Returns undefined if not found or expired. */
export function getAndDeletePaymentResult(
  checkoutRequestId: string,
): Omit<PaymentResult, "expiresAt"> | undefined {
  const entry = paymentResults.get(checkoutRequestId);
  if (!entry) return undefined;

  paymentResults.delete(checkoutRequestId);

  if (entry.expiresAt < Date.now()) return undefined;

  const { expiresAt: _discard, ...result } = entry;
  return result;
}

export default paymentResults;
