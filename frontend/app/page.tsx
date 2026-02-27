"use client";

import { useState } from "react";
import QRCode from "react-qr-code";

export default function AdminQRPage() {
  const [copied, setCopied] = useState(false);

  // Payment data that will be encoded in QR
  const paymentData = {
    merchantId: "PARKING_MERCHANT_001",
    amount: 10,
    currency: "KSH",
    type: "parking_payment",
    description: "Parking Payment",
    // This is the URL that will open when QR is scanned
    paymentUrl: `${process.env.NEXT_PUBLIC_APP_URL}/payment-selection`
  };

  // The QR code contains the direct URL to payment selection
  const qrCodeValue = paymentData.paymentUrl;

  const handleDownloadQR = () => {
    const svg = document.getElementById("qr-code");
    const svgData = new XMLSerializer().serializeToString(svg!);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");

      const downloadLink = document.createElement("a");
      downloadLink.download = "parking-payment-qr.png";
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const copyPaymentLink = () => {
    navigator.clipboard.writeText(paymentData.paymentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-[#1a1f2e] flex flex-col items-center justify-center px-6 py-8">
      <div className="w-full max-w-2xl">
        {/* Admin Header */}
        <div className="text-center mb-8">
          <h1 className="text-white text-[28px] sm:text-[36px] font-bold mb-3">
            Smart QR Scan To Pay
          </h1>
          <p className="text-gray-400 text-lg">
            Print this QR code for customers
          </p>
        </div>

        {/* QR Code Display */}
        <div className="bg-[#2a3441] rounded-[32px] p-4 sm:p-8 mb-6">
          <div className="bg-white rounded-[24px] p-4 sm:p-8 flex flex-col items-center">
            <QRCode
              id="qr-code"
              value={qrCodeValue}
              size={320}
              level="H"
              bgColor="#ffffff"
              fgColor="#1e293b"
              style={{ width: "100%", height: "auto", maxWidth: "320px" }}
            />

            {/* Center Logo */}
            <div className="mt-6 w-16 h-16 bg-[#1e293b] rounded-full flex items-center justify-center">
              <span className="text-white text-3xl font-bold">P</span>
            </div>

            <div className="mt-6 text-center">
              <p className="text-[#1e293b] text-sm uppercase tracking-wider mb-2">
                Daily Rate
              </p>
              <p className="text-[#1e293b] text-4xl font-bold">
                Ksh 10
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6 relative">
          <button
            onClick={handleDownloadQR}
            className="bg-[#10b981] hover:bg-[#059669] text-white py-4 px-6 rounded-[16px] font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download QR
          </button>

          <div className="relative">
            <button
              onClick={copyPaymentLink}
              className="w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white py-4 px-6 rounded-[16px] font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              Copy Link
            </button>
            {/* Copied popup */}
            {copied && (
              <div className="absolute -top-11 left-1/2 -translate-x-1/2 bg-[#1a1f2e] border border-[#10b981] text-[#10b981] text-sm font-medium px-4 py-2 rounded-[10px] whitespace-nowrap shadow-lg">
                ✓ Link copied!
              </div>
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-2 bg-[#2a3441] rounded-[20px] p-6">
          <h3 className="text-white text-lg font-semibold mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-[#10b981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            How It Works
          </h3>
          <ol className="text-gray-400 space-y-2 text-sm list-decimal list-inside">
            <li>Print this QR code and display it at parking location</li>
            <li>Customer scans QR code with phone camera</li>
            <li>Payment selection page opens automatically</li>
            <li>Customer selects M-Pesa or Visa payment</li>
            <li>Payment is processed securely</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
