"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { loadStripe } from "@stripe/stripe-js";

const AMOUNT = 10;

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
);

function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [verifying, setVerifying] = useState(false);

  const method = searchParams.get("method");
  const redirectStatus = searchParams.get("redirect_status");
  const paymentIntentClientSecret = searchParams.get("payment_intent_client_secret");

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
    <div className="min-h-screen bg-[#1a1f2e] flex flex-col items-center justify-between px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md">

        <div className="relative mb-8">
          <div className="absolute inset-0 bg-[#10b981] opacity-20 blur-3xl rounded-full" />
          <div className="relative w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br from-[#10b981] to-[#059669] rounded-full flex items-center justify-center border-4 border-[#10b981]/30">
            <svg className="w-12 h-12 sm:w-16 sm:h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <h1 className="text-white text-[26px] sm:text-[36px] font-bold mb-2 text-center">Payment Successful</h1>
        <p className="text-gray-400 text-sm mb-8 text-center">Your transaction has been confirmed</p>

        <div
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm mb-8 ${
            isVisa ? "bg-[#1e3a8a]/30 text-blue-300" : "bg-[#10b981]/20 text-[#10b981]"
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

        {!isVisa && (
          <div className="bg-[#10b981]/10 border border-[#10b981]/20 rounded-[16px] px-4 py-3 flex gap-3 items-start w-full mb-6">
            <svg className="w-5 h-5 text-[#10b981] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-300 text-sm leading-relaxed">
              An M-Pesa confirmation SMS has been sent to your phone. Keep it as your receipt.
            </p>
          </div>
        )}
      </div>

      <div className="w-full max-w-md pb-4 pt-6">
        <button
          onClick={() => router.push("/")}
          className="w-full bg-white hover:bg-gray-100 text-[#1a1f2e] text-[15px] sm:text-[17px] font-semibold py-4 sm:py-5 px-6 rounded-[20px] transition-colors"
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
