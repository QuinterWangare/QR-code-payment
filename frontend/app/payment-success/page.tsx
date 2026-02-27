"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const AMOUNT = 10;

export default function PaymentSuccessPage() {
  const router = useRouter();

  // Capture the exact time the user lands on this page (= payment confirmed)
  const [paidAt] = useState(() =>
    new Date().toLocaleString("en-KE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
  );

  useEffect(() => {
    const timer = setTimeout(() => router.push("/"), 10000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-[#1a1f2e] flex flex-col items-center justify-between px-6 py-8">
      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md">

        {/* Animated success icon */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-[#10b981] opacity-20 blur-3xl rounded-full" />
          <div className="relative w-32 h-32 bg-gradient-to-br from-[#10b981] to-[#059669] rounded-full flex items-center justify-center border-4 border-[#10b981]/30">
            <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <h1 className="text-white text-[36px] font-bold mb-2 text-center">Payment Successful</h1>
        <p className="text-gray-400 text-sm mb-8 text-center">Your transaction has been confirmed</p>

        {/* Receipt card */}
        <div className="w-full bg-[#2a3441] rounded-[24px] p-6 mb-6 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Amount Paid</span>
            <span className="text-white text-2xl font-bold">Ksh {AMOUNT}</span>
          </div>

          <div className="border-t border-white/10" />

          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Merchant</span>
            <span className="text-white text-sm font-medium">Parking QR Pay</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Time</span>
            <span className="text-white text-sm font-medium">{paidAt}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Status</span>
            <span className="inline-flex items-center gap-1.5 text-[#10b981] text-sm font-semibold">
              <span className="w-2 h-2 bg-[#10b981] rounded-full" />
              Completed
            </span>
          </div>
        </div>

        {/* M-Pesa SMS reminder */}
        <div className="bg-[#10b981]/10 border border-[#10b981]/20 rounded-[16px] px-4 py-3 flex gap-3 items-start w-full">
          <svg className="w-5 h-5 text-[#10b981] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p className="text-gray-300 text-sm leading-relaxed">
            An M-Pesa confirmation SMS has been sent to your phone. Keep it as your receipt.
          </p>
        </div>
      </div>

      {/* Done button */}
      <div className="w-full max-w-md pb-4 pt-6">
        <button
          onClick={() => router.push("/")}
          className="w-full bg-white hover:bg-gray-100 text-[#1a1f2e] text-[17px] font-semibold py-5 px-6 rounded-[20px] transition-colors"
        >
          Done
        </button>
        <p className="text-gray-500 text-xs text-center mt-4">
          Redirecting automatically in 10 seconds…
        </p>
      </div>
    </div>
  );
}