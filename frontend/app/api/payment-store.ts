// Module-level Map persists across requests in the same Next.js server process
const paymentResults = new Map<
  string,
  {
    status: "success" | "failed";
    amount?: number;
    receiptNumber?: string;
    phone?: string;
    message?: string;
  }
>();

export default paymentResults;
