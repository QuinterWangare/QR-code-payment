"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function PaymentSelectionPage() {
  const router = useRouter();
  const [fadeIn, setFadeIn] = useState(false);

  // Animate page entrance
  useEffect(() => {
    setFadeIn(true);
  }, []);

  const handleMpesaPayment = () => {
    router.push("/mpesa-payment");
  };

  const handleVisaPayment = () => {
    router.push("/visa-payment");
  };

  const handleCancel = () => {
    // Show confirmation before canceling
    if (confirm("Are you sure you want to cancel the payment?")) {
      window.close(); // Close the browser tab (works on mobile)
      // Fallback if window.close() doesn't work
      setTimeout(() => {
        router.push("/");
      }, 100);
    }
  };

  return (
    <div
      className={`min-h-screen bg-[#1a1f2e] flex flex-col items-center px-6 py-8 transition-opacity duration-500 ${fadeIn ? "opacity-100" : "opacity-0"
        }`}
    >
      {/* Welcome Message (shows user scanned successfully) */}
      <div className="w-full max-w-md mb-6 text-center">
        <div className="inline-flex items-center gap-2 bg-[#10b981]/20 text-[#10b981] px-4 py-2 rounded-full text-sm mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          QR Code Scanned Successfully
        </div>
      </div>

      {/* Header */}
      <div className="w-full max-w-md text-center mb-12">
        <h1 className="text-white text-[32px] font-bold mb-8">
          Confirm Payment
        </h1>
        <p className="text-gray-400 text-sm uppercase tracking-[0.2em] mb-3">
          Total Amount
        </p>
        <p className="text-white text-[56px] font-bold leading-none">
          Ksh 10
        </p>
      </div>

      {/* Payment Methods Section */}
      <div className="w-full max-w-md flex-1">
        <p className="text-gray-400 text-base mb-6">Select Payment Method</p>

        <div className="space-y-4">
          {/* M-Pesa Option */}
          <button
            onClick={handleMpesaPayment}
            className="w-full bg-[#2a3441] rounded-[24px] p-6 flex items-center gap-4 hover:bg-[#343d4d] active:scale-[0.98] transition-all group"
          >
            {/* M-Pesa Icon */}
            <div className="w-16 h-16 bg-[#10b981] rounded-[16px] flex items-center justify-center flex-shrink-0">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="8" width="4" height="12" rx="1" />
              </svg>
            </div>

            {/* Text Content */}
            <div className="flex-1 text-left">
              <h3 className="text-white text-xl font-semibold mb-1">M-Pesa</h3>
              <p className="text-gray-400 text-sm">Instant mobile money</p>
            </div>

            {/* Arrow Icon */}
            <svg
              className="w-6 h-6 text-gray-400 group-hover:text-white transition-colors"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Visa Card Option */}
          <button
            onClick={handleVisaPayment}
            className="w-full bg-[#2a3441] rounded-[24px] p-6 flex items-center gap-4 hover:bg-[#343d4d] active:scale-[0.98] transition-all group"
          >
            {/* Visa Icon */}
            <div className="w-16 h-16 bg-[#1e3a8a] rounded-[16px] flex items-center justify-center flex-shrink-0">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <path d="M2 10h20" stroke="white" strokeWidth="2" />
              </svg>
            </div>

            {/* Text Content */}
            <div className="flex-1 text-left">
              <h3 className="text-white text-xl font-semibold mb-1">Visa Card</h3>
              <p className="text-gray-400 text-sm">Debit or Credit card</p>
            </div>

            {/* Arrow Icon */}
            <svg
              className="w-6 h-6 text-gray-400 group-hover:text-white transition-colors"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Cancel Button */}
      <div className="w-full max-w-md pt-8 pb-4">
        <button
          onClick={handleCancel}
          className="w-full text-gray-400 py-5 text-[17px] font-medium hover:text-white transition-colors"
        >
          Cancel Payment
        </button>
      </div>
    </div>
  );
}