"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { initiateStkPush, queryStkStatus } from "@/lib/mpesa-api";

const SESSION_KEY = "qr_pay_checkout_id";
const AMOUNT = 10;
const MAX_ATTEMPTS = 12;
const NUDGE_AFTER_ATTEMPTS = 5;
const TIMEOUT_MS = 90_000;

function isSafaricomNumber(nineDigits: string): boolean {
  if (nineDigits.length < 3) return true;
  const p = parseInt(nineDigits.slice(0, 3), 10);
  return (
    (p >= 700 && p <= 729) ||
    (p >= 740 && p <= 749) ||
    (p >= 757 && p <= 759) ||
    (p >= 768 && p <= 769) ||
    (p >= 790 && p <= 799) ||
    p === 110 || p === 111 || p === 114 || p === 115
  );
}

function stkErrorMessage(reason: string | undefined, raw: string): string {
  switch (reason) {
    case "duplicate_transaction":
      return "A request to this number is still being processed. Please wait 30 seconds, then try again.";
    case "invalid_sender":
    case "invalid_receiver":
      return "This number could not be reached on M-Pesa. Double-check it and try again.";
    default:
      return raw || "Could not send the M-Pesa prompt. Please verify the number and try again.";
  }
}

export default function MpesaPaymentPage() {
  const router = useRouter();

  const [phoneNumber, setPhoneNumber] = useState("");
  const [sentToPhone, setSentToPhone] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<"sending" | "waiting" | "resuming">("sending");
  const [secondsLeft, setSecondsLeft] = useState(TIMEOUT_MS / 1000);
  const [error, setError] = useState("");
  const [showChangeNumber, setShowChangeNumber] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  const pollToken = useRef(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Reset ────────────────────────────────────────────────────────────────
  const resetToForm = useCallback(() => {
    pollToken.current += 1;
    if (countdownRef.current) clearInterval(countdownRef.current);
    sessionStorage.removeItem(SESSION_KEY);
    setIsProcessing(false);
    setProcessingStage("sending");
    setShowChangeNumber(false);
    setShowNudge(false);
    setTimedOut(false);
    setError("");
    setPhoneNumber("");
  }, []);

  // ─── Redirect helper ──────────────────────────────────────────────────────
  const redirectFailed = useCallback(
    (reason: string, message: string) => {
      sessionStorage.removeItem(SESSION_KEY);
      router.push(`/payment-failed?reason=${reason}&message=${encodeURIComponent(message)}`);
    },
    [router],
  );

  // ─── Core polling loop ────────────────────────────────────────────────────
  const startPolling = useCallback(
    (checkoutRequestId: string, delayFirstPoll = true) => {
      setIsProcessing(true);
      setProcessingStage("waiting");
      setSecondsLeft(TIMEOUT_MS / 1000);

      if (countdownRef.current) clearInterval(countdownRef.current);
      countdownRef.current = setInterval(() => {
        setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
      }, 1000);

      setShowNudge(false);
      setTimedOut(false);
      setShowChangeNumber(false);
      sessionStorage.setItem(SESSION_KEY, checkoutRequestId);

      const myToken = pollToken.current;
      let attempts = 0;

      const poll = async (): Promise<void> => {
        if (pollToken.current !== myToken) return;

        if (attempts >= MAX_ATTEMPTS) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          setTimedOut(true);
          return;
        }

        if (attempts === NUDGE_AFTER_ATTEMPTS) {
          setShowNudge(true);
        }

        attempts++;

        try {
          const data = await queryStkStatus(checkoutRequestId);
          if (pollToken.current !== myToken) return;

          if (data.status === "success") {
            if (countdownRef.current) clearInterval(countdownRef.current);
            sessionStorage.removeItem(SESSION_KEY);
            router.push("/payment-success");
          } else if (data.status === "failed") {
            if (countdownRef.current) clearInterval(countdownRef.current);
            redirectFailed(
              data.reason || "failed",
              data.message || "Payment was not completed. Please try again.",
            );
          } else {
            setTimeout(poll, 5000);
          }
        } catch {
          if (pollToken.current !== myToken) return;
          setTimeout(poll, 5000);
        }
      };

      setTimeout(poll, delayFirstPoll ? 5000 : 1000);
    },
    [router, redirectFailed],
  );

  // ─── On mount: resume an in-progress payment ──────────────────────────────
  useEffect(() => {
    const savedId = sessionStorage.getItem(SESSION_KEY);
    if (savedId) {
      setProcessingStage("resuming");
      startPolling(savedId, false);
    }
  }, [startPolling]);

  // ─── Phone number input ───────────────────────────────────────────────────
  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "");
    if (value.length <= 9) {
      setPhoneNumber(value);
      setError("");
    }
  };

  // ─── Send STK Push ────────────────────────────────────────────────────────
  const sendStkPush = useCallback(
    async (phone: string) => {
      const data = await initiateStkPush({
        phone: `254${phone}`,
        amount: AMOUNT,
        accountNumber: "QR-PAY",
      });

      if (!data.status) {
        setIsProcessing(false);
        setTimedOut(false);
        setError(stkErrorMessage("reason" in data ? data.reason : undefined, data.msg));
        return;
      }

      setSentToPhone(`+254${phone}`);
      startPolling(data.checkoutRequestId, true);
    },
    [startPolling],
  );

  // ─── Initiate new payment ─────────────────────────────────────────────────
  const handlePayment = async () => {
    if (phoneNumber.length !== 9) {
      setError("Please enter a valid 9-digit number after +254");
      return;
    }
    if (!isSafaricomNumber(phoneNumber)) {
      setError(
        "This number does not appear to be a Safaricom line. M-Pesa is only available on Safaricom.",
      );
      return;
    }
    if (isProcessing) return;

    setIsProcessing(true);
    setProcessingStage("sending");
    setTimedOut(false);
    setShowNudge(false);
    setError("");

    try {
      await sendStkPush(phoneNumber);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not reach the payment server. Please check your connection and try again.";
      setIsProcessing(false);
      setError(msg);
    }
  };

  // ─── Resend after timeout ─────────────────────────────────────────────────
  const handleResend = async () => {
    if (phoneNumber.length !== 9) return;
    setTimedOut(false);
    setShowNudge(false);
    setProcessingStage("sending");

    try {
      await sendStkPush(phoneNumber);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not reach the payment server.";
      setIsProcessing(false);
      setError(msg);
    }
  };

  const isPhoneValid = phoneNumber.length === 9;

  const stageLabel =
    processingStage === "sending"
      ? "Sending prompt to your phone..."
      : processingStage === "resuming"
        ? "Resuming your payment..."
        : `Waiting for PIN... ${secondsLeft}s`;

  return (
    <div className="min-h-screen bg-[#1a1f2e] flex flex-col px-4 sm:px-6 py-6 sm:py-8">

      {/* ── Change-number overlay ──────────────────────────────────────────── */}
      {showChangeNumber && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm px-4 pb-8">
          <div className="w-full max-w-md bg-[#1e2636] rounded-[28px] p-6 shadow-2xl">
            <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <h2 className="text-white text-xl font-bold text-center mb-2">Change Number?</h2>
            <p className="text-gray-400 text-sm text-center leading-relaxed mb-6">
              The M-Pesa prompt sent to{" "}
              <span className="text-white font-medium">{sentToPhone}</span> will be abandoned.
              You can re-enter the correct number and try again.
            </p>
            <button
              onClick={resetToForm}
              className="w-full bg-amber-500 hover:bg-amber-400 text-white font-semibold py-4 rounded-[16px] transition-colors mb-3"
            >
              Yes, use a different number
            </button>
            <button
              onClick={() => setShowChangeNumber(false)}
              className="w-full text-gray-400 hover:text-white font-medium py-3 transition-colors"
            >
              No, keep waiting
            </button>
          </div>
        </div>
      )}

      {/* Back Button */}
      <div className="w-full max-w-md mx-auto mb-6">
        <button
          onClick={() => {
            if (!isProcessing) {
              sessionStorage.removeItem(SESSION_KEY);
              router.back();
            }
          }}
          className="text-white p-2 hover:bg-[#2a3441] rounded-lg transition-colors disabled:opacity-40"
          aria-label="Go back"
          disabled={isProcessing}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Header */}
      <div className="w-full max-w-md mx-auto text-center mb-6 sm:mb-10">
        <h1 className="text-white text-[26px] sm:text-[32px] font-bold mb-5 sm:mb-8">M-Pesa Payment</h1>
        <p className="text-gray-400 text-sm uppercase tracking-[0.2em] mb-3">Total Amount</p>
        <p className="text-white text-[42px] sm:text-[56px] font-bold leading-none">Ksh {AMOUNT}</p>
      </div>

      {/* Payment Form */}
      <div className="w-full max-w-md mx-auto flex-1">
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
              <p className="text-gray-400 text-sm">Enter the M-Pesa number to pay from</p>
            </div>
          </div>
        </div>

        {/* Phone Number Input */}
        <div className="mb-2">
          <label className="block text-[#10b981] text-sm font-medium mb-3">Phone Number</label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white text-base sm:text-lg font-medium">
              +254
            </div>
            <input
              type="tel"
              inputMode="numeric"
              value={phoneNumber}
              onChange={handlePhoneNumberChange}
              placeholder="712345678"
              disabled={isProcessing}
              className="w-full bg-[#2a3441] text-white text-base sm:text-lg py-4 pl-[72px] sm:pl-20 pr-4 rounded-[16px] border-2 border-transparent focus:border-[#10b981] focus:outline-none transition-colors placeholder:text-gray-500 disabled:opacity-50"
              maxLength={9}
            />
          </div>
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        </div>

        {/* Wrong number? */}
        {isProcessing && processingStage === "waiting" && !timedOut && (
          <div className="mb-5 flex justify-end">
            <button
              onClick={() => setShowChangeNumber(true)}
              className="text-amber-400 text-sm hover:text-amber-300 transition-colors underline underline-offset-2"
            >
              Wrong number? Change it
            </button>
          </div>
        )}

        {/* Nudge */}
        {showNudge && !timedOut && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-[16px] p-4 mb-6 flex gap-3 items-start">
            <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="text-amber-300 text-sm leading-relaxed">
              Still waiting… Check that your phone received the M-Pesa prompt.
            </p>
          </div>
        )}

        {/* Timeout recovery panel */}
        {timedOut && (
          <div className="bg-[#2a3441] border border-white/10 rounded-[20px] p-5 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold text-sm">No response received</p>
                <p className="text-gray-400 text-xs mt-0.5">The prompt expired or was not entered in time.</p>
              </div>
            </div>
            <div className="space-y-2">
              <button
                onClick={handleResend}
                className="w-full bg-[#10b981] hover:bg-[#059669] text-white font-semibold py-3.5 rounded-[14px] transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Resend prompt to {sentToPhone}
              </button>
              <button
                onClick={resetToForm}
                className="w-full bg-[#1e2636] hover:bg-[#263347] text-gray-300 hover:text-white font-medium py-3.5 rounded-[14px] transition-colors text-sm"
              >
                Use a different number
              </button>
              <button
                onClick={() =>
                  redirectFailed(
                    "timeout",
                    "The payment confirmation timed out. If you already entered your PIN, please check your M-Pesa messages.",
                  )
                }
                className="w-full text-gray-500 hover:text-gray-300 font-medium py-2 transition-colors text-sm"
              >
                Cancel payment
              </button>
            </div>
          </div>
        )}

        {/* Info box */}
        {!timedOut && (
          <div className="bg-[#10b981]/10 border border-[#10b981]/30 rounded-[16px] p-4 mb-8">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-[#10b981] rounded-full flex items-center justify-center mt-0.5">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-300 text-sm leading-relaxed">
                An M-Pesa prompt will appear on your phone. Enter your PIN{" "}
                <strong className="text-white">within 60 seconds</strong> to complete the payment.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Pay button */}
      {!timedOut && (
        <div className="w-full max-w-md mx-auto pb-4">
          <button
            onClick={handlePayment}
            disabled={!isPhoneValid || isProcessing}
            className="w-full bg-[#10b981] hover:bg-[#059669] text-white text-[15px] sm:text-[17px] font-semibold py-4 sm:py-5 px-6 rounded-[20px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>{stageLabel}</span>
              </>
            ) : (
              <>
                Pay Ksh {AMOUNT} with M-Pesa
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-2 mt-6">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-gray-500 text-sm uppercase tracking-wider">Secure Payment</span>
          </div>
        </div>
      )}
    </div>
  );
}
