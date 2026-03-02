"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
);

const amount = 10;

// ─── Inner form component (must be inside <Elements>) ───────────────────────
function CheckoutForm({ clientSecret }: { clientSecret: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [saveCard, setSaveCard] = useState(true);

  const stripeFieldStyle = {
    base: {
      color: "#ffffff",
      fontFamily: "system-ui, sans-serif",
      fontSize: "18px",
      fontWeight: "600",
      letterSpacing: "0.05em",
      "::placeholder": { color: "#4b5563" },
      iconColor: "#ffffff",
    },
    invalid: { color: "#ef4444" },
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    const cardNumber = elements.getElement(CardNumberElement);
    if (!cardNumber) return;

    setIsProcessing(true);
    setErrorMessage("");

    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card: cardNumber },
    });

    if (error) {
      setErrorMessage(
        error.message ?? "An unexpected error occurred. Please try again.",
      );
      setIsProcessing(false);
    } else if (paymentIntent?.status === "succeeded") {
      router.push(`${process.env.NEXT_PUBLIC_APP_URL}/payment-success?method=visa`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col flex-1">
      {/* Card Container */}
      <div className="bg-[#1e2a3a] rounded-[24px] p-6 mb-6 border border-[#2d3f55]">
        {/* Card Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-[#1e3a8a] rounded-[10px] flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <path d="M2 10h20" stroke="white" strokeWidth="2" fill="none" />
            </svg>
          </div>
          <h2 className="text-white text-lg font-semibold">Visa Card Details</h2>
        </div>

        {/* Card Number Row */}
        <div className="mb-5">
          <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-2">
            Card Number
          </label>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <CardNumberElement
                options={{ style: stripeFieldStyle, showIcon: false }}
              />
            </div>
            {/* VISA badge */}
            <div className="bg-[#1e3a8a] rounded-[6px] px-2 py-1 flex-shrink-0">
              <span className="text-white text-xs font-black tracking-widest uppercase">VISA</span>
            </div>
          </div>
          <div className="h-px bg-[#2d3f55] mt-3" />
        </div>

        {/* Expiry + CVV Row */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-2">
              Expiry
            </label>
            <CardExpiryElement
              options={{ style: stripeFieldStyle }}
            />
            <div className="h-px bg-[#2d3f55] mt-3" />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-2">
              CVV
            </label>
            <CardCvcElement
              options={{ style: stripeFieldStyle }}
            />
            <div className="h-px bg-[#2d3f55] mt-3" />
          </div>
        </div>
      </div>

      {/* Save card checkbox */}
      <label className="flex items-center gap-3 mb-6 cursor-pointer select-none">
        <div
          onClick={() => setSaveCard(!saveCard)}
          className={`w-5 h-5 rounded-[5px] flex items-center justify-center flex-shrink-0 transition-colors ${saveCard ? "bg-[#1e3a8a] border-[#1e3a8a]" : "bg-transparent border border-gray-500"
            }`}
        >
          {saveCard && (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <span className="text-gray-300 text-sm">Save card securely for future parking</span>
      </label>

      {/* Error message */}
      {errorMessage && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-[16px] p-4 mb-6">
          <p className="text-red-400 text-sm">{errorMessage}</p>
        </div>
      )}

      {/* Security badges */}
      <div className="flex items-center justify-center gap-6 mb-8">
        <div className="flex items-center gap-2 text-gray-500 text-xs">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          SSL Encrypted
        </div>
        <div className="flex items-center gap-2 text-gray-500 text-xs">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2 7a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V7zm2 0v2h16V7H4zm0 4v6h16v-6H4z" />
          </svg>
          Powered by Stripe
        </div>
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full bg-[#1e3a8a] hover:bg-[#1e40af] text-white text-[15px] sm:text-[17px] font-semibold py-4 sm:py-5 px-6 rounded-[20px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isProcessing ? (
          <>
            <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Processing...
          </>
        ) : (
          <>
            Pay Ksh {amount} with Visa
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
        <span className="text-gray-500 text-sm uppercase tracking-wider">
          Secure Payment
        </span>
      </div>
    </form>
  );
}

// ─── Outer page component ────────────────────────────────────────────────────
export default function VisaPaymentPage() {
  const router = useRouter();
  const [clientSecret, setClientSecret] = useState("");
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState("");

  useEffect(() => {
    fetch("/api/create-payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, currency: "usd" }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.clientSecret) {
          throw new Error(data.msg || "Failed to initialize payment");
        }
        setClientSecret(data.clientSecret);
      })
      .catch((err) => setInitError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const elementsOptions = {
    clientSecret,
    appearance: {
      theme: "night" as const,
      variables: {
        colorPrimary: "#1e3a8a",
        colorBackground: "#2a3441",
        colorText: "#ffffff",
        colorDanger: "#ef4444",
        fontFamily: "system-ui, sans-serif",
        spacingUnit: "4px",
        borderRadius: "12px",
      },
    },
  };

  return (
    <div className="min-h-screen bg-[#1a1f2e] flex flex-col px-4 sm:px-6 py-6 sm:py-8">
      {/* Back Button */}
      <div className="w-full max-w-md mx-auto mb-6">
        <button
          onClick={() => router.back()}
          className="text-white p-2 hover:bg-[#2a3441] rounded-lg transition-colors"
          aria-label="Go back"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Header */}
      <div className="w-full max-w-md mx-auto text-center mb-6 sm:mb-10">
        <h1 className="text-white text-[26px] sm:text-[32px] font-bold mb-5 sm:mb-8">Visa Payment</h1>
        <p className="text-gray-400 text-sm uppercase tracking-[0.2em] mb-3">
          Total Amount
        </p>
        <p className="text-white text-[42px] sm:text-[56px] font-bold leading-none">
          Ksh {amount}
        </p>
      </div>

      {/* Main content area */}
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <svg className="animate-spin h-10 w-10 text-[#1e3a8a]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-gray-400 text-sm">Initializing payment...</p>
          </div>
        ) : initError ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="bg-red-500/10 border border-red-500/30 rounded-[20px] p-6 w-full text-center">
              <p className="text-red-400 text-sm mb-4">{initError}</p>
              <button
                onClick={() => router.back()}
                className="text-white bg-[#2a3441] hover:bg-[#343d4d] px-6 py-3 rounded-[12px] text-sm font-medium transition-colors"
              >
                Go Back
              </button>
            </div>
          </div>
        ) : (
          clientSecret && (
            <Elements stripe={stripePromise} options={elementsOptions}>
              <CheckoutForm clientSecret={clientSecret} />
            </Elements>
          )
        )}
      </div>
    </div>
  );
}
