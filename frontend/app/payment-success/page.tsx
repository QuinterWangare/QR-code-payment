"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const AMOUNT = 10;

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
);

function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [verifying, setVerifying] = useState(false);
  const method = searchParams.get("method"); // "visa" or null (mpesa)
  const redirectStatus = searchParams.get("redirect_status");
  const paymentIntentClientSecret = searchParams.get(
    "payment_intent_client_secret",
  );

  useEffect(() => {
    // If returning from Stripe, verify the payment status
    if (method === "visa" && paymentIntentClientSecret) {
      setVerifying(true);
      stripePromise.then(async (stripe) => {
        if (!stripe) return;
        const { paymentIntent } = await stripe.retrievePaymentIntent(
          paymentIntentClientSecret,
        );
        setVerifying(false);
        if (
          paymentIntent?.status === "succeeded" ||
          paymentIntent?.status === "processing"
        ) {
          // Persist confirmed status to DB
          fetch("/api/stripe-confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentIntentId: paymentIntent.id }),
          }).catch(console.error);
        } else {
          router.replace("/payment-failed?method=visa");
        }
      });
    }

    if (redirectStatus === "failed") {
      router.replace("/payment-failed?method=visa");
    }
  }, [method, paymentIntentClientSecret, redirectStatus, router]);

  // Auto-redirect to home after 10s
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push("/");
    }, 10000);
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

  if (verifying) {
    return (
      <div className="min-h-screen bg-[#1a1f2e] flex flex-col items-center justify-center px-6 py-8">
        <svg className="animate-spin h-12 w-12 text-white mb-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <p className="text-gray-400">Verifying payment...</p>
      </div>
    );
  }

  const isVisa = method === "visa";

  return (
    <div className="min-h-screen bg-[#1a1f2e] flex flex-col items-center justify-between px-6 py-8">
      {/* Success Icon */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-[#10b981] opacity-20 blur-3xl rounded-full"></div>
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

        <h1 className="text-white text-[36px] font-bold mb-4">
          Payment Successful
        </h1>

        <p className="text-gray-400 text-lg mb-6 text-center max-w-sm">
          Your parking session has been paid.
        </p>

        {/* Payment method badge */}
        <div
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm mb-10 ${
            isVisa
              ? "bg-[#1e3a8a]/30 text-blue-300"
              : "bg-[#10b981]/20 text-[#10b981]"
          }`}
        >
          {isVisa ? (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2 7a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V7z" />
              </svg>
              Paid via Visa Card
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="8" width="4" height="12" rx="1" />
              </svg>
              Paid via M-Pesa
            </>
          )}
        </div>

        {/* Amount Card */}
        <div className="w-full max-w-md bg-[#2a3441] rounded-[24px] p-8 mb-8">
          <p className="text-gray-400 text-sm uppercase tracking-[0.2em] text-center mb-3">
            Amount Paid
          </p>
          <p className="text-white text-[48px] font-bold text-center leading-none">
            Ksh 10
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

        <p className="text-gray-500 text-sm">
          Redirecting to home in a few seconds...
        </p>
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

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#1a1f2e] flex items-center justify-center">
          <svg className="animate-spin h-10 w-10 text-white" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}
