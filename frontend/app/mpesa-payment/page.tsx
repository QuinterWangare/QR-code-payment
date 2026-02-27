"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

const TIMEOUT_MS = 90_000; // 90 seconds to enter PIN

export default function MpesaPaymentPage() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<"sending" | "waiting">("sending");
  const [secondsLeft, setSecondsLeft] = useState(TIMEOUT_MS / 1000);
  const [error, setError] = useState("");
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const amount = 10;

  const clearAllTimers = () => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    if (hardTimerRef.current) clearTimeout(hardTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "");
    if (value.length <= 9) {
      setPhoneNumber(value);
      setError("");
    }
  };

  const handlePayment = async () => {
    if (phoneNumber.length !== 9) {
      setError("Please enter a valid phone number");
      return;
    }

    setIsProcessing(true);
    setProcessingStage("sending");
    setError("");

    try {
      const formattedPhone = `254${phoneNumber}`;

      const response = await fetch("/api/stkpush", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formattedPhone, amount, accountNumber: "QR-PAY" }),
      });

      const data = await response.json();

      if (!response.ok || !data.status) {
        throw new Error(data.msg || "Payment initiation failed");
      }

      const checkoutRequestId = data.checkoutRequestId;
      setProcessingStage("waiting");
      setSecondsLeft(TIMEOUT_MS / 1000);

      // --- countdown display ---
      countdownRef.current = setInterval(() => {
        setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
      }, 1000);

      // --- hard timeout: mark failed + go home ---
      hardTimerRef.current = setTimeout(async () => {
        clearAllTimers();
        // Mark transaction as failed in DB
        try {
          await fetch("/api/mpesa-timeout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ checkoutRequestId }),
          });
        } catch { /* ignore */ }
        router.push("/");
      }, TIMEOUT_MS);

      // --- poll DB status every 3 seconds ---
      const pollDB = async () => {
        try {
          const res = await fetch(`/api/mpesa-status/${encodeURIComponent(checkoutRequestId)}`);
          const statusData = await res.json();

          if (statusData.status === "success") {
            clearAllTimers();
            router.push("/payment-success?method=mpesa");
            return;
          } else if (statusData.status === "failed") {
            clearAllTimers();
            setError("Payment was cancelled or failed. Please try again.");
            setIsProcessing(false);
            return;
          }
        } catch { /* ignore, retry */ }

        // Still pending — also double-check via Safaricom STK query
        try {
          const stkRes = await fetch("/api/stkquery", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ checkoutRequestId }),
          });
          const stkData = await stkRes.json();

          if (stkData.status === "success") {
            clearAllTimers();
            router.push("/payment-success?method=mpesa");
            return;
          } else if (stkData.status === "failed") {
            clearAllTimers();
            setError(stkData.message || "Payment was cancelled or failed.");
            setIsProcessing(false);
            return;
          }
        } catch { /* ignore */ }

        // Still pending — schedule next poll
        pollTimerRef.current = setTimeout(pollDB, 3000);
      };

      // First check after 5s (time for user to open M-Pesa app)
      pollTimerRef.current = setTimeout(pollDB, 5000);

    } catch (err: unknown) {
      clearAllTimers();
      setError(err instanceof Error ? err.message : "Payment failed. Please try again.");
      setIsProcessing(false);
    }
  };

  const isPhoneNumberValid = phoneNumber.length === 9;

  return (
    <div className="min-h-screen bg-[#1a1f2e] flex flex-col px-6 py-8">
      {/* Back Button */}
      <div className="w-full max-w-md mx-auto mb-6">
        <button
          onClick={() => router.back()}
          className="text-white p-2 hover:bg-[#2a3441] rounded-lg transition-colors"
          aria-label="Go back"
          disabled={isProcessing}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Header */}
      <div className="w-full max-w-md mx-auto text-center mb-12">
        <h1 className="text-white text-[32px] font-bold mb-8">
          M-Pesa Payment
        </h1>

        <p className="text-gray-400 text-sm uppercase tracking-[0.2em] mb-3">
          Total Amount
        </p>
        <p className="text-white text-[56px] font-bold leading-none">
          Ksh {amount}
        </p>
      </div>

      {/* Payment Form */}
      <div className="w-full max-w-md mx-auto flex-1">
        {/* M-Pesa Express Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-[#10b981] rounded-[12px] flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="8" width="4" height="12" rx="1" />
              </svg>
            </div>
            <div>
              <h2 className="text-white text-xl font-semibold">M-Pesa Express</h2>
              <p className="text-gray-400 text-sm">Enter phone number to pay</p>
            </div>
          </div>
        </div>

        {/* Phone Number Input */}
        <div className="mb-6">
          <label className="block text-[#10b981] text-sm font-medium mb-3">
            Phone Number
          </label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white text-lg font-medium">
              +254
            </div>
            <input
              type="tel"
              value={phoneNumber}
              onChange={handlePhoneNumberChange}
              placeholder="e.g. 0712345678"
              disabled={isProcessing}
              className="w-full bg-[#2a3441] text-white text-lg py-4 pl-20 pr-4 rounded-[16px] border-2 border-transparent focus:border-[#10b981] focus:outline-none transition-colors placeholder:text-gray-500 disabled:opacity-50"
              maxLength={9}
            />
          </div>
          {error && (
            <p className="text-red-400 text-sm mt-2">{error}</p>
          )}
        </div>

        {/* Info Box */}
        <div className="bg-[#10b981]/10 border border-[#10b981]/30 rounded-[16px] p-4 mb-8">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 bg-[#10b981] rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-gray-300 text-sm leading-relaxed">
                You will receive a payment prompt on your phone. Please enter your M-Pesa PIN to complete the transaction.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Button */}
      <div className="w-full max-w-md mx-auto pb-4">
        <button
          onClick={handlePayment}
          disabled={!isPhoneNumberValid || isProcessing}
          className="w-full bg-[#10b981] hover:bg-[#059669] text-white text-[17px] font-semibold py-5 px-6 rounded-[20px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {processingStage === "sending"
                ? "Sending prompt..."
                : `Waiting for PIN... ${secondsLeft}s`}
            </>
          ) : (
            <>
              Pay Ksh {amount} with M-Pesa
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </>
          )}
        </button>

        {/* Secure Payment Footer */}
        <div className="flex items-center justify-center gap-2 mt-6">
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="text-gray-500 text-sm uppercase tracking-wider">
            Secure Payment
          </span>
        </div>
      </div>
    </div>
  );
}