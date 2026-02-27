"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function PaymentSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    // Optional: Auto-redirect after 5 seconds
    const timer = setTimeout(() => {
      router.push("/");
    }, 10000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-[#1a1f2e] flex flex-col items-center justify-between px-6 py-8">
      {/* Success Icon */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="relative mb-8">
          {/* Glowing Circle */}
          <div className="absolute inset-0 bg-[#10b981] opacity-20 blur-3xl rounded-full"></div>

          {/* Main Circle */}
          <div className="relative w-32 h-32 bg-gradient-to-br from-[#10b981] to-[#059669] rounded-full flex items-center justify-center border-4 border-[#10b981]/30">
            <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-white text-[36px] font-bold mb-4">
          Payment Successful
        </h1>

        {/* Subtitle */}
        <p className="text-gray-400 text-lg mb-12 text-center max-w-sm">
          Your parking session has been paid.
        </p>

        {/* Amount Card */}
        <div className="w-full max-w-md bg-[#2a3441] rounded-[24px] p-8 mb-8">
          <p className="text-gray-400 text-sm uppercase tracking-[0.2em] text-center mb-3">
            Amount Paid
          </p>
          <p className="text-white text-[48px] font-bold text-center leading-none">
            Ksh 10
          </p>
        </div>
      </div>

      {/* Done Button */}
      <div className="w-full max-w-md pb-4">
        <button
          onClick={() => router.push("/")}
          className="w-full bg-white hover:bg-gray-100 text-[#1a1f2e] text-[17px] font-semibold py-5 px-6 rounded-[20px] transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}