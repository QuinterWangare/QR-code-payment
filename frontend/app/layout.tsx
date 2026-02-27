import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Smart QR Scan to Pay",
  description: "Scan, pay and go — secure parking payments via M-Pesa and Visa directly from your phone.",
  openGraph: {
    title: "Smart QR Scan to Pay",
    description: "Scan, pay and go — secure parking payments via M-Pesa and Visa.",
    type: "website",
  },
};

// Viewport and theme-color must be exported separately in Next.js 14+
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1a1f2e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} antialiased bg-[#1a1f2e] text-white`}
      >
        {children}
      </body>
    </html>
  );
}