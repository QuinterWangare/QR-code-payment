"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

// Map short reason keys to display config
const reasonConfig: Record<string, { title: string; badge: string; tip: string }> = {
  insufficient_balance: {
    title: "Insufficient Balance",
    badge: "Balance Too Low",
    tip: "Please top up your M-Pesa balance by dialling *844# on your phone, then try again.",
  },
  wrong_pin: {
    title: "Wrong PIN Entered",
    badge: "PIN Incorrect",
    tip: "Make sure you enter your correct M-Pesa PIN (4–6 digits). If you have forgotten your PIN, dial *100# to reset it.",
  },
  cancelled: {
    title: "Payment Cancelled",
    badge: "Cancelled",
    tip: "You dismissed the payment prompt. Press Try Again whenever you are ready to pay.",
  },
  timeout: {
    title: "Request Timed Out",
    badge: "Timed Out",
    tip: "The STK prompt is only active for about 60 seconds. Press Try Again and enter your PIN as soon as the prompt appears on your phone.",
  },
  duplicate_transaction: {
    title: "Transaction Already in Progress",
    badge: "Duplicate Request",
    tip: "Another M-Pesa payment is already active for this number — possibly from a previous scan. Wait 1–2 minutes for that session to expire, then try again. Avoid pressing Pay more than once.",
  },
  subscriber_locked: {
    title: "Account Temporarily Locked",
    badge: "Account Locked",
    tip: "Your M-Pesa account is temporarily busy processing another transaction. Wait a minute and try again.",
  },
  daily_limit: {
    title: "Daily Limit Reached",
    badge: "Limit Exceeded",
    tip: "You have reached your M-Pesa daily transaction limit. Try again after midnight or call Safaricom on 0722 000 100.",
  },
  below_minimum: {
    title: "Amount Too Low",
    badge: "Below Minimum",
    tip: "The payment amount is below the minimum allowed by M-Pesa. Please contact the parking operator.",
  },
  above_maximum: {
    title: "Amount Too High",
    badge: "Above Maximum",
    tip: "The payment amount exceeds the M-Pesa per-transaction limit. Please contact the parking operator.",
  },
  below_min_balance: {
    title: "Minimum Balance Required",
    badge: "Balance Warning",
    tip: "This payment would leave your account below the M-Pesa minimum required balance. Top up and try again.",
  },
  invalid_sender: {
    title: "Account Not Found",
    badge: "Invalid Account",
    tip: "Your M-Pesa account could not be verified. Please check you entered the correct phone number (9 digits after +254).",
  },
  invalid_receiver: {
    title: "Invalid Recipient",
    badge: "Recipient Error",
    tip: "The recipient account is invalid. Please try again or contact the parking operator.",
  },
  invalid_account: {
    title: "Account Not Active",
    badge: "Account Invalid",
    tip: "Your M-Pesa account is not enabled for this transaction. Contact Safaricom on 0722 000 100.",
  },
  internal_error: {
    title: "M-Pesa Service Error",
    badge: "Service Error",
    tip: "M-Pesa encountered an internal error. This is temporary — please wait a few minutes and try again.",
  },
  limit_exceeded: {
    title: "Transaction Limit Reached",
    badge: "Limit Exceeded",
    tip: "You may have hit your M-Pesa daily transaction limit. Try again after midnight or contact Safaricom on 0722 000 100.",
  },
  rejected: {
    title: "Transaction Rejected",
    badge: "Rejected",
    tip: "Your transaction was rejected by M-Pesa. Please try again. If this keeps happening, contact Safaricom on *100#.",
  },
  failed: {
    title: "Payment Failed",
    badge: "Failed",
    tip: "Something went wrong with your payment. Please try again. If the problem persists, contact Safaricom on *100#.",
  },
};

const defaultConfig = {
  title: "Payment Failed",
  badge: "Failed",
  tip: "Something went wrong. Please try again.",
};

function PaymentFailedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const reason = searchParams.get("reason") || "failed";
  const message = searchParams.get("message") || "";

  const config = reasonConfig[reason] ?? defaultConfig;

  const handleRetry = () => {
    router.push("/mpesa-payment");
  };

  const handleClose = () => {
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-[#1a1f2e] flex flex-col items-center justify-between px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md">
        {/* Error Icon */}
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-[#ef4444] opacity-20 blur-3xl rounded-full"></div>
          <div className="relative w-20 h-20 sm:w-28 sm:h-28 bg-gradient-to-br from-[#ef4444] to-[#dc2626] rounded-full flex items-center justify-center border-4 border-[#ef4444]/30">
            <svg className="w-10 h-10 sm:w-14 sm:h-14 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        </div>

        {/* Reason Badge */}
        <span className="inline-block bg-[#ef4444]/20 text-[#ef4444] text-xs font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full mb-4">
          {config.badge}
        </span>

        {/* Title */}
        <h1 className="text-white text-[24px] sm:text-[30px] font-bold mb-3 text-center">
          {config.title}
        </h1>

        {/* Human-readable message from backend / Safaricom */}
        {message && (
          <p className="text-gray-300 text-base text-center mb-6 leading-relaxed px-2">
            {message}
          </p>
        )}

        {/* Amount Card */}
        <div className="w-full bg-[#2a3441] rounded-[24px] p-6 mb-6">
          <p className="text-gray-400 text-xs uppercase tracking-[0.2em] text-center mb-2">
            Amount
          </p>
          <p className="text-white text-[40px] font-bold text-center leading-none">
            Ksh 10
          </p>
        </div>

        {/* What To Do Tip */}
        <div className="w-full bg-[#1e2a3a] border border-[#2a3441] rounded-[20px] p-5">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-[#f59e0b]/20 rounded-full flex items-center justify-center mt-0.5">
              <svg className="w-4 h-4 text-[#f59e0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <p className="text-[#f59e0b] text-xs font-semibold uppercase tracking-wider mb-1">
                What to do
              </p>
              <p className="text-gray-300 text-sm leading-relaxed">
                {config.tip}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="w-full max-w-md space-y-4 pt-8 pb-4">
        <button
          onClick={handleRetry}
          className="w-full bg-[#ef4444] hover:bg-[#dc2626] text-white text-[15px] sm:text-[17px] font-semibold py-4 sm:py-5 px-6 rounded-[20px] transition-colors"
        >
          Try Again
        </button>

        <button
          onClick={handleClose}
          className="w-full bg-transparent border-2 border-[#2a3441] hover:border-gray-600 text-white text-[15px] sm:text-[17px] font-semibold py-4 sm:py-5 px-6 rounded-[20px] transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default function PaymentFailedPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#1a1f2e] flex items-center justify-center">
          <div className="text-white text-lg">Loading...</div>
        </div>
      }
    >
      <PaymentFailedContent />
    </Suspense>
  );
}
