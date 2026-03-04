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
  CONSUMER_SECRET:
    "8Kxsm5UGAPxR16bZ26QsTZYGkXUXGMivR0aWA8RkVGw1G4avvSF5RF9u11sc5aG0",
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
  return Buffer.from(MPESA.SHORTCODE + MPESA.PASSKEY + timestamp).toString(
    "base64",
  );
}

/** Cached OAuth token — Safaricom tokens last 3600 s; refresh 60 s early. */
let _tokenCache = { token: "", expiresAt: 0 };

/** Return a valid access token, fetching a fresh one only when necessary. */
async function getAccessToken() {
  if (_tokenCache.token && Date.now() < _tokenCache.expiresAt) {
    return _tokenCache.token;
  }
  const auth =
    "Basic " +
    Buffer.from(`${MPESA.CONSUMER_KEY}:${MPESA.CONSUMER_SECRET}`).toString(
      "base64",
    );
  const { data } = await axios.get(
    `${MPESA.BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: auth } },
  );
  _tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in ?? 3600) - 60) * 1000,
  };
  console.log("[Auth] Fetched new M-Pesa access token");
  return _tokenCache.token;
}

// ─── In-memory payment results store ─────────────────────────────────────────
const paymentResults = new Map();

// ─── Server-Sent Events clients map ──────────────────────────────────────────
// checkoutRequestId → Set<Response>  (one Set per active payment)
const sseClients = new Map();

/**
 * Push a payment result to every SSE subscriber for this transaction,
 * then close their connections. Called immediately from handleCallback.
 */
function notifySseClients(checkoutRequestId, payload) {
  const clients = sseClients.get(checkoutRequestId);
  if (!clients?.size) return;
  const event = `data: ${JSON.stringify({ type: "result", ...payload })}\n\n`;
  clients.forEach((res) => {
    try { res.write(event); res.end(); } catch { /* client already disconnected */ }
  });
  sseClients.delete(checkoutRequestId);
  console.log(`[SSE] 📡 Pushed result to ${clients.size} subscriber(s):`, checkoutRequestId);
}

// ─── STK Query result-code map ────────────────────────────────────────────────
const STK_FAILURE_MAP = {
  1: {
    reason: "insufficient_balance",
    message:
      "You do not have enough M-Pesa balance. Please top up your account and try again.",
  },
  2: {
    reason: "below_minimum",
    message:
      "The payment amount is below the minimum allowed M-Pesa transaction value.",
  },
  3: {
    reason: "above_maximum",
    message:
      "The payment amount exceeds the maximum allowed M-Pesa transaction value.",
  },
  4: {
    reason: "daily_limit",
    message:
      "This transaction would exceed your M-Pesa daily transfer limit. Try again after midnight or contact Safaricom.",
  },
  5: {
    reason: "below_min_balance",
    message:
      "This payment would leave your M-Pesa account below the minimum required balance. Top up and try again.",
  },
  6: {
    reason: "invalid_sender",
    message:
      "Your M-Pesa account could not be verified. Please check you entered the correct phone number.",
  },
  7: {
    reason: "invalid_receiver",
    message:
      "The recipient (merchant) account is invalid. Please contact the parking operator.",
  },
  11: {
    reason: "invalid_account",
    message:
      "Your M-Pesa account is not enabled for this type of transaction. Contact Safaricom on 0722 000 100.",
  },
  17: {
    reason: "internal_error",
    message:
      "M-Pesa encountered an internal error. This is temporary — please wait a few minutes and try again.",
  },
  1001: {
    reason: "subscriber_locked",
    message:
      "Your M-Pesa account is busy processing another transaction. Wait 1-2 minutes, then try again.",
  },
  1025: {
    reason: "duplicate_transaction",
    message:
      "A payment to this number is already being processed. Wait 1-2 minutes for it to expire, then try again.",
  },
  1031: {
    reason: "duplicate_transaction",
    message:
      "Safaricom rejected this as a duplicate request. Wait 1-2 minutes before trying again.",
  },
  1032: {
    reason: "cancelled",
    message:
      "You dismissed the M-Pesa payment prompt. Tap Try Again whenever you are ready to pay.",
  },
  1037: {
    reason: "timeout",
    message:
      "The M-Pesa prompt expired before your PIN was entered. Tap Try Again and enter your PIN as soon as it appears.",
  },
  2001: {
    reason: "wrong_pin",
    message:
      "Incorrect M-Pesa PIN entered. Please try again with your correct 4-digit PIN.",
  },
};

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "Smart QR Pay — M-Pesa Backend",
    timestamp: new Date().toISOString(),
  });
});

app.get("/access_token", async (_req, res, next) => {
  try {
    const token = await getAccessToken();
    res.json({
      status: "ok",
      hint: "Credentials are valid",
      tokenPreview: token.slice(0, 12) + "…",
    });
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
 * GET /api/payment-stream/:checkoutRequestId
 * Server-Sent Events endpoint — holds the connection open and pushes
 * {type:"result", status, ...} the instant the M-Pesa callback arrives.
 * The frontend opens this alongside polling so success is shown immediately.
 */
app.get("/api/payment-stream/:checkoutRequestId", (req, res) => {
  const { checkoutRequestId } = req.params;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
  res.flushHeaders();

  // If the callback already arrived before the client connected, send immediately.
  if (paymentResults.has(checkoutRequestId)) {
    const cached = paymentResults.get(checkoutRequestId);
    paymentResults.delete(checkoutRequestId);
    res.write(`data: ${JSON.stringify({ type: "result", ...cached })}\n\n`);
    res.end();
    console.log("[SSE] ⚡ Instant result from cache:", checkoutRequestId);
    return;
  }

  // Register this client.
  if (!sseClients.has(checkoutRequestId)) sseClients.set(checkoutRequestId, new Set());
  sseClients.get(checkoutRequestId).add(res);
  console.log("[SSE] 🔌 Client connected:", checkoutRequestId);

  // Keep-alive heartbeat every 20 s so proxies don't close the connection.
  const heartbeat = setInterval(() => {
    try { res.write(": heartbeat\n\n"); } catch { clearInterval(heartbeat); }
  }, 20_000);

  // Clean up when this specific client disconnects.
  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.get(checkoutRequestId)?.delete(res);
    if (sseClients.get(checkoutRequestId)?.size === 0) sseClients.delete(checkoutRequestId);
    console.log("[SSE] 🔌 Client disconnected:", checkoutRequestId);
  });
});

/** Helper: call Safaricom STK Push with up to `maxRetries` retries on 5xx. */
async function safaricomStkPush(payload, authHeader, maxRetries = 3) {
  let lastErr;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { data } = await axios.post(
        `${MPESA.BASE_URL}/mpesa/stkpush/v1/processrequest`,
        payload,
        { headers: { Authorization: authHeader } },
      );
      return data;
    } catch (err) {
      lastErr = err;
      const status = err.response?.status ?? 0;
      if (status >= 500 && attempt < maxRetries) {
        console.warn(
          `[STK Push] Safaricom ${status} on attempt ${attempt}, retrying…`,
        );
        await new Promise((r) => setTimeout(r, 500 * attempt)); // 0.5s, 1s back-off
        continue;
      }
      throw err; // non-5xx or exhausted retries
    }
  }
  throw lastErr;
}

/**
 * POST /api/stkpush
 * Initiate an M-Pesa STK Push prompt on the customer's phone.
 */
app.post("/api/stkpush", async (req, res, next) => {
  try {
    let { phone: phoneNumber, amount, accountNumber = "QR-PAY" } = req.body;

    if (!phoneNumber || !amount) {
      return res
        .status(400)
        .json({ msg: "phone and amount are required", status: false });
    }
    if (isNaN(amount) || Number(amount) <= 0) {
      return res
        .status(400)
        .json({ msg: "amount must be a positive number", status: false });
    }

    if (String(phoneNumber).startsWith("0")) {
      phoneNumber = "254" + String(phoneNumber).slice(1);
    }

    const accessToken = await getAccessToken();
    const timestamp = moment().format("YYYYMMDDHHmmss");
    const password = getMpesaPassword(timestamp);
    const callbackUrl = `${process.env.BACKEND_NGROK_URL}/api/callback`;

    const data = await safaricomStkPush(
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
      `Bearer ${accessToken}`,
    );

    console.log("[STK Push]", data);

    const responseCode = String(data.ResponseCode ?? "0");
    if (responseCode !== "0") {
      return res.status(400).json({
        status: false,
        reason: "failed",
        msg: data.ResponseDescription || "Payment request rejected by M-Pesa.",
      });
    }

    const checkoutRequestId = data.CheckoutRequestID;

    await prisma.transaction
      .create({
        data: {
          method: "mpesa",
          status: "pending",
          amount: parseFloat(amount),
          phone: phoneNumber,
          checkoutRequestId,
          accountReference: accountNumber,
          description: "QR Parking Payment",
        },
      })
      .catch(console.error);

    return res.json({
      status: true,
      checkoutRequestId,
      msg: "STK prompt sent. Please enter your M-Pesa PIN.",
    });
  } catch (err) {
    // Surface any remaining Safaricom error as a plain 500 for debugging
    if (err.response) {
      const errData = err.response.data ?? {};
      const errMsg =
        errData.ResponseDescription ||
        errData.errorMessage ||
        errData.error_description ||
        err.message;
      console.error(
        `[STK Push] Safaricom error [${err.response.status}]:`,
        errMsg,
      );
      return res
        .status(500)
        .json({ status: false, reason: "mpesa_error", msg: errMsg });
    }
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
      return res
        .status(400)
        .json({ msg: "checkoutRequestId is required", status: false });
    }

    // ── Fast path: M-Pesa callback already arrived ────────────────────────
    // The callback handler stores results here immediately. If it's present
    // we can respond in <1 ms without touching Safaricom at all.
    if (paymentResults.has(checkoutRequestId)) {
      const cached = paymentResults.get(checkoutRequestId);
      paymentResults.delete(checkoutRequestId);
      console.log(
        "[STK Query] ⚡ Served from callback cache:",
        checkoutRequestId,
      );
      return res.json(cached);
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
    // Codes and description phrases Safaricom uses while the request is still
    // being processed — must return "pending" so the client keeps polling.
    // Code 17 ("Rule limited") is also transient in sandbox — the callback
    // will arrive with the real result shortly, so never fail prematurely.
    const PENDING_CODES = new Set(["9999", "17", "500.001.1001", "500.001.1000"]);
    const PROCESSING_PHRASES = [
      "still under processing",
      "being processed",
      "request is being processed",
      "rule limited",
      "transaction is being processed",
      "under processing",
    ];
    const isStillProcessing = PROCESSING_PHRASES.some((p) =>
      resultDesc.toLowerCase().includes(p),
    );

    if (resultCode === "0") {
      console.log("[STK Query] ✅ Success:", checkoutRequestId);
      return res.json({ status: "success" });
    }

    // Check processing phrases BEFORE the failure map so we never
    // mis-classify an in-progress transaction as failed.
    if (isStillProcessing || PENDING_CODES.has(resultCode)) {
      console.log(`[STK Query] ⏳ Still processing [${resultCode}]: ${resultDesc}`);
      return res.json({ status: "pending" });
    }

    if (STK_FAILURE_MAP[resultCode]) {
      console.log(
        `[STK Query] ❌ Failure [${resultCode}]:`,
        STK_FAILURE_MAP[resultCode].reason,
      );
      return res.json({ status: "failed", ...STK_FAILURE_MAP[resultCode] });
    }

    // Unknown / undocumented code — Safaricom sometimes returns transient codes
    // while the user is still entering their PIN. Treat as pending and keep
    // polling; the callback will deliver the definitive result.
    console.log(`[STK Query] ⏳ Unknown code (treating as pending) [${resultCode}]: ${resultDesc}`);
    return res.json({ status: "pending" });
  } catch (err) {
    const errData = err.response?.data;
    const errCode = String(errData?.ResultCode ?? errData?.errorCode ?? "");
    const errDesc = String(
      errData?.ResultDesc ?? errData?.errorMessage ?? "",
    ).toLowerCase();

    // These codes / phrases from Safaricom mean the request is still queued —
    // not a hard failure.  Keep the client polling.
    const PENDING_ERR_CODES = new Set(["500.001.1001", "500.001.1000", "1001", "17"]);
    const processingInDesc = [
      "still under processing",
      "being processed",
      "rule limited",
      "under processing",
      "transaction is being processed",
    ].some((p) => errDesc.includes(p));
    if (PENDING_ERR_CODES.has(errCode) || processingInDesc) {
      console.log(`[STK Query] ⏳ Pending (error body) [${errCode}]: ${errDesc}`);
      return res.json({ status: "pending" });
    }

    // Only treat explicit non-processing failure codes as failures.
    if (errCode && STK_FAILURE_MAP[errCode] && errCode !== "1001") {
      console.log(
        `[STK Query] ❌ Failure in error body [${errCode}]:`,
        STK_FAILURE_MAP[errCode].reason,
      );
      return res.json({ status: "failed", ...STK_FAILURE_MAP[errCode] });
    }

    // Unknown error from Safaricom — keep polling rather than failing prematurely.
    console.error("[STK Query] Unexpected error (treating as pending):", errData || err.message);
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
      // 📡 Push to any waiting SSE clients immediately — no polling lag.
      notifySseClients(CheckoutRequestID, result);
      prisma.transaction
        .updateMany({
          where: { checkoutRequestId: CheckoutRequestID },
          data: {
            status: "success",
            mpesaReceiptNumber: result.receiptNumber
              ? String(result.receiptNumber)
              : null,
            amount: result.amount ? parseFloat(result.amount) : undefined,
            phone: result.phone ? String(result.phone) : undefined,
          },
        })
        .catch(console.error);
      console.log("[Callback] ✅ Payment success:", {
        CheckoutRequestID,
        ...result,
      });
    } else {
      // Look up the specific reason so the frontend shows the right message
      // (e.g. "Wrong PIN", "Cancelled", "Insufficient balance") rather than
      // the generic fallback.
      const mapped = STK_FAILURE_MAP[ResultCode];
      const failedResult = {
        status: "failed",
        reason: mapped?.reason ?? "failed",
        message: mapped?.message ?? ResultDesc ?? "Payment was not completed. Please try again.",
      };
      paymentResults.set(CheckoutRequestID, failedResult);
      // 📡 Push failure to SSE clients too so they don't wait the full poll cycle.
      notifySseClients(CheckoutRequestID, failedResult);
      prisma.transaction
        .updateMany({
          where: { checkoutRequestId: CheckoutRequestID },
          data: { status: "failed", description: ResultDesc },
        })
        .catch(console.error);
      console.log(`[Callback] ❌ Payment failed [${ResultCode}]: ${ResultDesc}`);
    }

    fs.writeFile(
      "stkcallback.json",
      JSON.stringify(req.body, null, 2),
      "utf8",
      (err) => {
        if (err)
          console.error(
            "[Callback] Failed to write stkcallback.json:",
            err.message,
          );
      },
    );

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

  // Never forward raw Safaricom / upstream 5xx statuses — they confuse the
  // client into thinking OUR server is down.  Translate them to a structured
  // 503 with a helpful reason so the frontend can show a friendly message.
  const upstreamStatus = err.response?.status ?? err.status ?? 500;
  if (upstreamStatus >= 500 && upstreamStatus < 600 && err.response) {
    return res.status(503).json({
      status: false,
      reason: "service_unavailable",
      msg: "M-Pesa service is temporarily unavailable. Please wait a moment and try again.",
    });
  }

  const status = upstreamStatus <= 599 ? upstreamStatus : 500;
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
    await prisma.transaction
      .create({
        data: {
          method: "visa",
          status: "pending",
          amount: parseFloat(amount),
          currency: currency.toUpperCase(),
          stripePaymentId: paymentIntent.id,
          description: "QR Parking Payment - Card",
        },
      })
      .catch(console.error);
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
      return res
        .status(400)
        .json({ msg: "paymentIntentId is required", status: false });
    }
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const txStatus =
      paymentIntent.status === "succeeded" ? "success" : "failed";
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
    const tx = await prisma.transaction.findFirst({
      where: { checkoutRequestId },
    });
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
