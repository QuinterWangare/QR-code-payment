import express from "express";
import http from "http";
import bodyParser from "body-parser";
import axios from "axios";
import moment from "moment";
import cors from "cors";
import fs from "fs";
import Stripe from "stripe";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const _adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: _adapter });

// ─── Server config ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const HOSTNAME = "localhost";

// ─── M-Pesa Daraja config (sandbox) ──────────────────────────────────────────
const MPESA = {
  CONSUMER_KEY: "NYv04jWkZtGN0XGniFrQXVaaWqXYE9o6cG5C1C7X2Jd9q0Gk",
  CONSUMER_SECRET: "8Kxsm5UGAPxR16bZ26QsTZYGkXUXGMivR0aWA8RkVGw1G4avvSF5RF9u11sc5aG0",
  SHORTCODE: "174379",
  PASSKEY: "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919",
  BASE_URL: "https://sandbox.safaricom.co.ke",
  TRANSACTION_TYPE: "CustomerPayBillOnline",
};

// ─── App setup ────────────────────────────────────────────────────────────────
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors());

const server = http.createServer(app);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generate the base64 password required by Safaricom for every STK request. */
function getMpesaPassword(timestamp) {
  return Buffer.from(MPESA.SHORTCODE + MPESA.PASSKEY + timestamp).toString("base64");
}

/** Fetch a short-lived OAuth access token from Safaricom. */
async function getAccessToken() {
  const auth = "Basic " + Buffer.from(`${MPESA.CONSUMER_KEY}:${MPESA.CONSUMER_SECRET}`).toString("base64");
  const { data } = await axios.get(
    `${MPESA.BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: auth } },
  );
  return data.access_token;
}

// ─── In-memory payment results store ─────────────────────────────────────────
const paymentResults = new Map();

// ─── STK Query result-code map ────────────────────────────────────────────────
const STK_FAILURE_MAP = {
  "1":    { reason: "insufficient_balance",  message: "You do not have enough M-Pesa balance. Please top up your account and try again." },
  "2":    { reason: "below_minimum",         message: "The payment amount is below the minimum allowed M-Pesa transaction value." },
  "3":    { reason: "above_maximum",         message: "The payment amount exceeds the maximum allowed M-Pesa transaction value." },
  "4":    { reason: "daily_limit",           message: "This transaction would exceed your M-Pesa daily transfer limit. Try again after midnight or contact Safaricom." },
  "5":    { reason: "below_min_balance",     message: "This payment would leave your M-Pesa account below the minimum required balance. Top up and try again." },
  "6":    { reason: "invalid_sender",        message: "Your M-Pesa account could not be verified. Please check you entered the correct phone number." },
  "7":    { reason: "invalid_receiver",      message: "The recipient (merchant) account is invalid. Please contact the parking operator." },
  "11":   { reason: "invalid_account",       message: "Your M-Pesa account is not enabled for this type of transaction. Contact Safaricom on 0722 000 100." },
  "17":   { reason: "internal_error",        message: "M-Pesa encountered an internal error. This is temporary — please wait a few minutes and try again." },
  "1001": { reason: "subscriber_locked",     message: "Your M-Pesa account is busy processing another transaction. Wait 1-2 minutes, then try again." },
  "1025": { reason: "duplicate_transaction", message: "A payment to this number is already being processed. Wait 1-2 minutes for it to expire, then try again." },
  "1031": { reason: "duplicate_transaction", message: "Safaricom rejected this as a duplicate request. Wait 1-2 minutes before trying again." },
  "1032": { reason: "cancelled",             message: "You dismissed the M-Pesa payment prompt. Tap Try Again whenever you are ready to pay." },
  "1037": { reason: "timeout",               message: "The M-Pesa prompt expired before your PIN was entered. Tap Try Again and enter your PIN as soon as it appears." },
  "2001": { reason: "wrong_pin",             message: "Incorrect M-Pesa PIN entered. Please try again with your correct 4-digit PIN." },
};

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "Smart QR Pay — M-Pesa Backend", timestamp: new Date().toISOString() });
});

app.get("/access_token", async (_req, res, next) => {
  try {
    const token = await getAccessToken();
    res.json({ status: "ok", hint: "Credentials are valid", tokenPreview: token.slice(0, 12) + "…" });
  } catch (err) {
    next(err);
  }
});

app.get("/api/payment-status/:checkoutRequestId", (req, res) => {
  const { checkoutRequestId } = req.params;
  const result = paymentResults.get(checkoutRequestId);
  if (!result) return res.json({ status: "pending" });
  paymentResults.delete(checkoutRequestId);
  return res.json(result);
});

/**
 * POST /api/stkpush
 * Initiate an M-Pesa STK Push prompt on the customer's phone.
 */
app.post("/api/stkpush", async (req, res, next) => {
  try {
    let { phone: phoneNumber, amount, accountNumber = "QR-PAY" } = req.body;

    if (!phoneNumber || !amount) {
      return res.status(400).json({ msg: "phone and amount are required", status: false });
    }
    if (isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({ msg: "amount must be a positive number", status: false });
    }

    if (String(phoneNumber).startsWith("0")) {
      phoneNumber = "254" + String(phoneNumber).slice(1);
    }

    const accessToken = await getAccessToken();
    const timestamp = moment().format("YYYYMMDDHHmmss");
    const password = getMpesaPassword(timestamp);
    const callbackUrl = `${process.env.BACKEND_NGROK_URL}/api/callback`;

    const { data } = await axios.post(
      `${MPESA.BASE_URL}/mpesa/stkpush/v1/processrequest`,
      {
        BusinessShortCode: MPESA.SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: MPESA.TRANSACTION_TYPE,
        Amount: Number(amount),
        PartyA: phoneNumber,
        PartyB: MPESA.SHORTCODE,
        PhoneNumber: phoneNumber,
        CallBackURL: callbackUrl,
        AccountReference: accountNumber,
        TransactionDesc: "QR Parking Payment",
      },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    console.log("[STK Push]", data);

    const responseCode = String(data.ResponseCode ?? "0");
    if (responseCode !== "0") {
      const isDuplicate = ["1001", "1025", "1031"].includes(responseCode);
      return res.status(400).json({
        status: false,
        reason: isDuplicate ? "duplicate_transaction" : "failed",
        msg: data.ResponseDescription || "Payment request rejected by M-Pesa.",
      });
    }

    const checkoutRequestId = data.CheckoutRequestID;

    await prisma.transaction.create({
      data: {
        method: "mpesa",
        status: "pending",
        amount: parseFloat(amount),
        phone: phoneNumber,
        checkoutRequestId,
        accountReference: accountNumber,
        description: "QR Parking Payment",
      },
    }).catch(console.error);

    return res.json({
      status: true,
      checkoutRequestId,
      msg: "STK prompt sent. Please enter your M-Pesa PIN.",
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/stkquery
 * Query the current status of an STK Push transaction directly from Safaricom.
 */
app.post("/api/stkquery", async (req, res, next) => {
  try {
    const { checkoutRequestId } = req.body;
    if (!checkoutRequestId) {
      return res.status(400).json({ msg: "checkoutRequestId is required", status: false });
    }

    const accessToken = await getAccessToken();
    const timestamp = moment().format("YYYYMMDDHHmmss");
    const password = getMpesaPassword(timestamp);

    const { data } = await axios.post(
      `${MPESA.BASE_URL}/mpesa/stkpushquery/v1/query`,
      {
        BusinessShortCode: MPESA.SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    const resultCode = String(data.ResultCode ?? "");
    const resultDesc = data.ResultDesc || "";
    const PENDING_CODES = new Set(["9999", "500.001.1001"]);

    if (resultCode === "0") {
      console.log("[STK Query] ✅ Success:", checkoutRequestId);
      return res.json({ status: "success" });
    }

    if (STK_FAILURE_MAP[resultCode]) {
      console.log(`[STK Query] ❌ Failure [${resultCode}]:`, STK_FAILURE_MAP[resultCode].reason);
      return res.json({ status: "failed", ...STK_FAILURE_MAP[resultCode] });
    }

    if (PENDING_CODES.has(resultCode)) {
      return res.json({ status: "pending" });
    }

    console.log(`[STK Query] ❌ Unrecognised code [${resultCode}]: ${resultDesc}`);
    return res.json({
      status: "failed",
      reason: "failed",
      message: resultDesc || "Payment was not completed. Please try again.",
    });
  } catch (err) {
    const errData = err.response?.data;
    const errCode = String(errData?.ResultCode ?? errData?.errorCode ?? "");

    if (errCode && STK_FAILURE_MAP[errCode]) {
      console.log(`[STK Query] ❌ Failure in error body [${errCode}]:`, STK_FAILURE_MAP[errCode].reason);
      return res.json({ status: "failed", ...STK_FAILURE_MAP[errCode] });
    }

    if (errCode === "500.001.1001" || errData?.errorCode === "500.001.1001") {
      return res.json({ status: "pending" });
    }

    console.error("[STK Query] Unexpected error:", errData || err.message);
    return res.json({ status: "pending" });
  }
});

/**
 * POST /api/callback  (also aliased as POST /callback for legacy Daraja config)
 */
function handleCallback(req, res) {
  try {
    const stkCallback = req.body?.Body?.stkCallback;
    if (!stkCallback) {
      console.warn("[Callback] Received malformed callback body");
      return res.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const { CheckoutRequestID, ResultCode, ResultDesc } = stkCallback;

    if (ResultCode === 0) {
      const items = stkCallback.CallbackMetadata?.Item || [];
      const find = (name) => items.find((i) => i.Name === name)?.Value;
      const result = {
        status: "success",
        amount: find("Amount"),
        receiptNumber: find("MpesaReceiptNumber"),
        phone: find("PhoneNumber"),
      };
      paymentResults.set(CheckoutRequestID, result);
      prisma.transaction.updateMany({
        where: { checkoutRequestId: CheckoutRequestID },
        data: {
          status: "success",
          mpesaReceiptNumber: result.receiptNumber ? String(result.receiptNumber) : null,
          amount: result.amount ? parseFloat(result.amount) : undefined,
          phone: result.phone ? String(result.phone) : undefined,
        },
      }).catch(console.error);
      console.log("[Callback] ✅ Payment success:", { CheckoutRequestID, ...result });
    } else {
      paymentResults.set(CheckoutRequestID, { status: "failed", message: ResultDesc });
      prisma.transaction.updateMany({
        where: { checkoutRequestId: CheckoutRequestID },
        data: { status: "failed", description: ResultDesc },
      }).catch(console.error);
      console.log(`[Callback] ❌ Payment failed [${ResultCode}]: ${ResultDesc}`);
    }

    fs.writeFile("stkcallback.json", JSON.stringify(req.body, null, 2), "utf8", (err) => {
      if (err) console.error("[Callback] Failed to write stkcallback.json:", err.message);
    });

    return res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (err) {
    console.error("[Callback] Unexpected error:", err.message);
    return res.status(500).json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
}

app.post("/api/callback", handleCallback);
app.post("/callback", handleCallback);

// ─── Global error-handling middleware ─────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("[Server Error]", err.message);
  const status = err.status || 500;
  res.status(status).json({
    status: false,
    msg: err.message || "An unexpected server error occurred.",
  });
});

/** Stripe - Create Payment Intent */
app.post("/api/create-payment-intent", async (req, res) => {
  try {
    const { amount, currency = "kes" } = req.body;
    if (!amount) {
      return res.status(400).json({ msg: "Amount is required", status: false });
    }
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: currency,
      payment_method_types: ["card"],
      metadata: { integration: "qr-parking" },
    });
    await prisma.transaction.create({
      data: {
        method: "visa",
        status: "pending",
        amount: parseFloat(amount),
        currency: currency.toUpperCase(),
        stripePaymentId: paymentIntent.id,
        description: "QR Parking Payment - Card",
      },
    }).catch(console.error);
    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      status: true,
    });
  } catch (error) {
    console.log("Stripe error:", error.message);
    res.status(500).json({ msg: error.message, status: false });
  }
});

/** Stripe - Confirm payment status after redirect */
app.post("/api/stripe-confirm", async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    if (!paymentIntentId) {
      return res.status(400).json({ msg: "paymentIntentId is required", status: false });
    }
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const txStatus = paymentIntent.status === "succeeded" ? "success" : "failed";
    await prisma.transaction.updateMany({
      where: { stripePaymentId: paymentIntentId },
      data: { status: txStatus },
    });
    res.json({ status: txStatus, ok: true });
  } catch (error) {
    console.log("Stripe confirm error:", error.message);
    res.status(500).json({ msg: error.message, status: false });
  }
});

/** Check M-Pesa transaction status from DB */
app.get("/api/mpesa-status/:checkoutRequestId", async (req, res) => {
  const { checkoutRequestId } = req.params;
  try {
    const tx = await prisma.transaction.findFirst({ where: { checkoutRequestId } });
    if (!tx) return res.json({ status: "pending" });
    res.json({ status: tx.status, mpesaReceiptNumber: tx.mpesaReceiptNumber });
  } catch (error) {
    console.log("mpesa-status error:", error.message);
    res.json({ status: "pending" });
  }
});

/** Mark an M-Pesa transaction as failed */
app.post("/api/mpesa-timeout", async (req, res) => {
  const { checkoutRequestId } = req.body;
  try {
    await prisma.transaction.updateMany({
      where: { checkoutRequestId, status: "pending" },
      data: { status: "failed" },
    });
    res.json({ status: true });
  } catch (error) {
    console.log("mpesa-timeout error:", error.message);
    res.json({ status: false });
  }
});

/** Get all transactions */
app.get("/api/transactions", async (req, res) => {
  try {
    const transactions = await prisma.transaction.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json({ transactions, status: true });
  } catch (error) {
    console.log("Transactions fetch error:", error.message);
    res.status(500).json({ msg: error.message, status: false });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, HOSTNAME, () => {
  console.log(`✅ Smart QR Pay backend running at http://${HOSTNAME}:${PORT}`);
  console.log(`   Callback URL: ${process.env.BACKEND_NGROK_URL}/api/callback`);
});
