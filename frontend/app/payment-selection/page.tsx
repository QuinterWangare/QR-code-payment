"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function PaymentSelectionPage() {
  const router = useRouter();
  const [fadeIn, setFadeIn] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showQrBadge, setShowQrBadge] = useState(true);
  const [qrBadgeFading, setQrBadgeFading] = useState(false);

  useEffect(() => {
    setFadeIn(true);
    // Start fading out at 7 s, fully remove at 10 s
    const fadeTimer = setTimeout(() => setQrBadgeFading(true), 7000);
    const hideTimer = setTimeout(() => setShowQrBadge(false), 10000);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  const handleMpesaPayment = () => {
    router.push("/mpesa-payment");
  };

  const handleVisaPayment = () => {
    router.push("/visa-payment");
  };

  const handleCancel = () => {
    setShowCancelModal(true);
  };

  const confirmCancel = () => {
    setShowCancelModal(false);
    window.close(); // Works when page was opened by another window / scanner
    // Fallback: navigate home if window.close() was blocked
    setTimeout(() => router.push("/"), 100);
  };

  return (
    <div
      className={`min-h-screen bg-[#1a1f2e] flex flex-col items-center px-6 py-8 transition-opacity duration-500 ${fadeIn ? "opacity-100" : "opacity-0"
        }`}
    >
      {/* ─── Cancel Confirmation Modal ─────────────────────────────────────── */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-6">
          <div className="w-full max-w-sm bg-[#242b38] rounded-[24px] p-8 shadow-2xl">
            {/* Icon */}
            <div className="flex justify-center mb-5">
              <div className="w-14 h-14 bg-red-500/20 rounded-full flex items-center justify-center">
                <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
            {/* Text */}
            <h2 className="text-white text-xl font-bold text-center mb-2">Cancel Payment?</h2>
            <p className="text-gray-400 text-sm text-center mb-8">
              Your payment has not been processed. Are you sure you want to leave?
            </p>
            {/* Actions */}
            <div className="flex flex-col gap-3">
              <button
                onClick={confirmCancel}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-4 rounded-[16px] transition-colors"
              >
                Yes, Cancel Payment
              </button>
              <button
                onClick={() => setShowCancelModal(false)}
                className="w-full bg-[#2a3441] hover:bg-[#343d4d] text-white font-semibold py-4 rounded-[16px] transition-colors"
              >
                No, Go Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── QR Scanned toast (auto-dismisses after 10 s) ──────────────────── */}
      {showQrBadge && (
        <div
          className={`fixed top-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-[#10b981] text-white px-5 py-3 rounded-full shadow-lg text-sm font-medium transition-all duration-700 ${qrBadgeFading ? "opacity-0 -translate-y-2" : "opacity-100 translate-y-0"
            }`}
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          QR Code Scanned Successfully
        </div>
      )}

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