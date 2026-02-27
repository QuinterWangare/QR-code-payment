"use client";

import { useRouter } from "next/navigation";

export default function PaymentFailedPage() {
  const router = useRouter();

  const handleRetry = () => {
    router.back();
  };

  const handleClose = () => {
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-[#1a1f2e] flex flex-col items-center justify-between px-6 py-8">
      {/* Error Icon */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="relative mb-8">
          {/* Glowing Circle */}
          <div className="absolute inset-0 bg-[#ef4444] opacity-20 blur-3xl rounded-full"></div>

          {/* Main Circle */}
          <div className="relative w-32 h-32 bg-gradient-to-br from-[#ef4444] to-[#dc2626] rounded-full flex items-center justify-center border-4 border-[#ef4444]/30">
            <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-white text-[36px] font-bold mb-4">
          Payment Failed
        </h1>

        {/* Subtitle */}
        <p className="text-gray-400 text-lg mb-12 text-center max-w-sm">
          Something went wrong with your transaction. Please try again.
        </p>

        {/* Amount Card */}
        <div className="w-full max-w-md bg-[#2a3441] rounded-[24px] p-8 mb-8">
          <p className="text-gray-400 text-sm uppercase tracking-[0.2em] text-center mb-3">
            Amount
          </p>
          <p className="text-white text-[48px] font-bold text-center leading-none">
            Ksh 10
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="w-full max-w-md space-y-4 pb-4">
        <button
          onClick={handleRetry}
          className="w-full bg-[#ef4444] hover:bg-[#dc2626] text-white text-[17px] font-semibold py-5 px-6 rounded-[20px] transition-colors"
        >
          Try Again
        </button>

        <button
          onClick={handleClose}
          className="w-full bg-transparent border-2 border-[#2a3441] hover:border-gray-600 text-white text-[17px] font-semibold py-5 px-6 rounded-[20px] transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}