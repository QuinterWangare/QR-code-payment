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

const port = 5000;
const hostname = "localhost";
const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors());

const server = http.createServer(app);

app.get("/", (req, res) => {
  res.send("********************  MPESA DARAJA API  ********************");
  var timeStamp = moment().format("YYYYMMDDHHmmss");
  console.log(timeStamp);
});

/** Access Token Route */
app.get("/access_token", (req, res) => {
  getAccessToken()
    .then((accessToken) => {
      res.send("Your access token is " + accessToken);
    })
    .catch(console.log);
});

/** Access Token Function */
async function getAccessToken() {
  const consumer_key = "NYv04jWkZtGN0XGniFrQXVaaWqXYE9o6cG5C1C7X2Jd9q0Gk";
  const consumer_secret =
    "8Kxsm5UGAPxR16bZ26QsTZYGkXUXGMivR0aWA8RkVGw1G4avvSF5RF9u11sc5aG0";
  const url =
    "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
  const auth =
    "Basic " +
    Buffer.from(consumer_key + ":" + consumer_secret).toString("base64");

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: auth,
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    const dataresponse = response.data;
    const accessToken = dataresponse.access_token;
    return accessToken;
  } catch (error) {
    throw error;
  }
}

/** STK Push Route (legacy GET - hardcoded) */
app.get("/stkpush", (req, res) => {
  getAccessToken()
    .then((accessToken) => {
      const url =
        "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest";
      const auth = "Bearer " + accessToken;
      const timestamp = moment().format("YYYYMMDDHHmmss");
      const password = Buffer.from(
        "174379" +
          "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919" +
          timestamp,
      ).toString("base64");

      axios
        .post(
          url,
          {
            BusinessShortCode: "174379",
            Password: password,
            Timestamp: timestamp,
            TransactionType: "CustomerPayBillOnline",
            Amount: "1",
            PartyA: 254768174504,
            PartyB: "174379",
            PhoneNumber: 254768174504,
            CallBackURL: `${process.env.BACKEND_NGROK_URL}/api/callback`,
            AccountReference: "Quinter",
            TransactionDesc: "Mpesa Daraja API stk push test",
          },
          {
            headers: {
              Authorization: auth,
            },
          },
        )
        .then((response) => {
          res.send(
            "Request is successful done ✔✔. Please check your phone and enter mpesa pin to complete the transaction",
          );
        })
        .catch((error) => {
          console.log(error);
          res.status(500).send("❌ Request failed");
        });
    })
    .catch(console.log);
});

// In-memory store for payment callback results
const paymentResults = new Map();

/** Payment status polling endpoint */
app.get("/api/payment-status/:checkoutRequestId", (req, res) => {
  const { checkoutRequestId } = req.params;
  const result = paymentResults.get(checkoutRequestId);

  if (!result) {
    return res.json({ status: "pending" });
  }

  // Clean up after reading
  paymentResults.delete(checkoutRequestId);
  return res.json(result);
});

/** STK Push Route (POST - dynamic phone & amount from frontend) */
app.post("/api/stkpush", (req, res) => {
  let phoneNumber = req.body.phone;
  const accountNumber = req.body.accountNumber || "QR-PAY";
  const amount = req.body.amount;

  if (!phoneNumber || !amount) {
    return res
      .status(400)
      .json({ msg: "Phone number and amount are required", status: false });
  }

  // Normalize phone: if starts with 0, replace with 254
  if (phoneNumber.startsWith("0")) {
    phoneNumber = "254" + phoneNumber.slice(1);
  }

  getAccessToken()
    .then((accessToken) => {
      const url =
        "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest";
      const auth = "Bearer " + accessToken;
      const timestamp = moment().format("YYYYMMDDHHmmss");
      const password = Buffer.from(
        "174379" +
          "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919" +
          timestamp,
      ).toString("base64");

      axios
        .post(
          url,
          {
            BusinessShortCode: "174379",
            Password: password,
            Timestamp: timestamp,
            TransactionType: "CustomerPayBillOnline",
            Amount: amount,
            PartyA: phoneNumber,
            PartyB: "174379",
            PhoneNumber: phoneNumber,
            CallBackURL: `${process.env.BACKEND_NGROK_URL}/api/callback`,
            AccountReference: accountNumber,
            TransactionDesc: "QR Parking Payment",
          },
          {
            headers: {
              Authorization: auth,
            },
          },
        )
        .then(async (response) => {
          console.log(response.data);
          const checkoutRequestId = response.data.CheckoutRequestID;
          // Save pending transaction to DB
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
          res.status(200).json({
            msg: "Request successful ✔✔. Please enter M-Pesa PIN to complete the transaction.",
            status: true,
            checkoutRequestId,
          });
        })
        .catch((error) => {
          console.log(error.response?.data || error.message);
          res.status(500).json({
            msg: "STK push request failed",
            status: false,
          });
        });
    })
    .catch((error) => {
      console.log(error);
      res
        .status(500)
        .json({ msg: "Failed to get access token", status: false });
    });
});

/** STK Query Route - Check payment status directly from Safaricom */
app.post("/api/stkquery", (req, res) => {
  const { checkoutRequestId } = req.body;

  if (!checkoutRequestId) {
    return res
      .status(400)
      .json({ msg: "checkoutRequestId is required", status: false });
  }

  getAccessToken()
    .then((accessToken) => {
      const url = "https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query";
      const auth = "Bearer " + accessToken;
      const timestamp = moment().format("YYYYMMDDHHmmss");
      const password = Buffer.from(
        "174379" +
          "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919" +
          timestamp,
      ).toString("base64");

      axios
        .post(
          url,
          {
            BusinessShortCode: "174379",
            Password: password,
            Timestamp: timestamp,
            CheckoutRequestID: checkoutRequestId,
          },
          { headers: { Authorization: auth } },
        )
        .then((response) => {
          const resultCode = response.data.ResultCode;
          // ResultCode "0" = success, "1032" = cancelled by user, "1037" = timeout
          if (resultCode === "0" || resultCode === 0) {
            res.json({ status: "success" });
          } else if (resultCode === "1032" || resultCode === 1032) {
            res.json({ status: "failed", message: "Payment was cancelled." });
          } else if (resultCode === "1037" || resultCode === 1037) {
            res.json({
              status: "failed",
              message: "Payment request timed out.",
            });
          } else {
            // Still pending or unknown
            res.json({
              status: "pending",
              resultCode,
              resultDesc: response.data.ResultDesc,
            });
          }
        })
        .catch((error) => {
          const errorData = error.response?.data;
          // errorCode 500.001.1001 means the request is still being processed (pending)
          if (errorData?.errorCode === "500.001.1001") {
            res.json({ status: "pending" });
          } else {
            console.log("STK Query error:", errorData || error.message);
            res.json({ status: "pending" });
          }
        });
    })
    .catch((error) => {
      console.log(error);
      res.status(500).json({ status: "pending" });
    });
});

app.post("/api/callback", (req, res) => {
  console.log("STK PUSH CALLBACK");
  const stkCallback = req.body.Body.stkCallback;
  const CheckoutRequestID = stkCallback.CheckoutRequestID;
  const ResultCode = stkCallback.ResultCode;
  const ResultDesc = stkCallback.ResultDesc;

  if (ResultCode === 0) {
    const metadata = stkCallback.CallbackMetadata?.Item || [];
    const amount = metadata.find((i) => i.Name === "Amount")?.Value;
    const receiptNumber = metadata.find(
      (i) => i.Name === "MpesaReceiptNumber",
    )?.Value;
    const phone = metadata.find((i) => i.Name === "PhoneNumber")?.Value;
    paymentResults.set(CheckoutRequestID, {
      status: "success",
      amount,
      receiptNumber,
      phone,
    });
    // Update transaction in DB
    prisma.transaction.updateMany({
      where: { checkoutRequestId: CheckoutRequestID },
      data: {
        status: "success",
        mpesaReceiptNumber: receiptNumber ? String(receiptNumber) : null,
        amount: amount ? parseFloat(amount) : undefined,
        phone: phone ? String(phone) : undefined,
      },
    }).catch(console.error);
    console.log("✅ Payment successful:", {
      CheckoutRequestID,
      amount,
      receiptNumber,
      phone,
    });
  } else {
    paymentResults.set(CheckoutRequestID, {
      status: "failed",
      message: ResultDesc,
    });
    // Update transaction in DB
    prisma.transaction.updateMany({
      where: { checkoutRequestId: CheckoutRequestID },
      data: { status: "failed", description: ResultDesc },
    }).catch(console.error);
    console.log("❌ Payment failed:", ResultDesc);
  }

  var json = JSON.stringify(req.body);
  fs.writeFile("stkcallback.json", json, "utf8", function (err) {
    if (err) return console.log(err);
    console.log("STK PUSH CALLBACK JSON FILE SAVED");
  });
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

/** C2B URL Registration */
app.get("/registerurl", (req, resp) => {
  getAccessToken()
    .then((accessToken) => {
      const url = "https://sandbox.safaricom.co.ke/mpesa/c2b/v2/registerurl";
      const auth = "Bearer " + accessToken;
      axios
        .post(
          url,
          {
            ShortCode: "174379",
            ResponseType: "Complete",
            ConfirmationURL: "http://example.com/confirmation",
            ValidationURL: "http://example.com/validation",
          },
          {
            headers: {
              Authorization: auth,
            },
          },
        )
        .then((response) => {
          resp.status(200).json(response.data);
        })
        .catch((error) => {
          console.log(error);
          resp.status(500).send("❌ Request failed");
        });
    })
    .catch(console.log);
});

app.get("/confirmation", (req, res) => {
  console.log("All transaction will be sent to this URL");
  console.log(req.body);
});

app.get("/validation", (req, resp) => {
  console.log("Validating payment");
  console.log(req.body);
});

app.get("/b2curlrequest", (req, res) => {
  getAccessToken()
    .then((accessToken) => {
      const securityCredential =
        "N3Lx/hisedzPLxhDMDx80IcioaSO7eaFuMC52Uts4ixvQ/Fhg5LFVWJ3FhamKur/bmbFDHiUJ2KwqVeOlSClDK4nCbRIfrqJ+jQZsWqrXcMd0o3B2ehRIBxExNL9rqouKUKuYyKtTEEKggWPgg81oPhxQ8qTSDMROLoDhiVCKR6y77lnHZ0NU83KRU4xNPy0hRcGsITxzRWPz3Ag+qu/j7SVQ0s3FM5KqHdN2UnqJjX7c0rHhGZGsNuqqQFnoHrshp34ac/u/bWmrApUwL3sdP7rOrb0nWasP7wRSCP6mAmWAJ43qWeeocqrz68TlPDIlkPYAT5d9QlHJbHHKsa1NA==";
      const url = "https://sandbox.safaricom.co.ke/mpesa/b2c/v1/paymentrequest";
      const auth = "Bearer " + accessToken;
      axios
        .post(
          url,
          {
            InitiatorName: "testapi",
            SecurityCredential: securityCredential,
            CommandID: "PromotionPayment",
            Amount: "1",
            PartyA: "600996",
            PartyB: "", //phone number to receive the stk push
            Remarks: "Withdrawal",
            QueueTimeOutURL: "https://mydomain.com/b2c/queue",
            ResultURL: "https://mydomain.com/b2c/result",
            Occasion: "Withdrawal",
          },
          {
            headers: {
              Authorization: auth,
            },
          },
        )
        .then((response) => {
          res.status(200).json(response.data);
        })
        .catch((error) => {
          console.log(error);
          res.status(500).send("❌ Request failed");
        });
    })
    .catch(console.log);
});

/** Stripe - Create Payment Intent */
app.post("/api/create-payment-intent", async (req, res) => {
  try {
    const { amount, currency = "kes" } = req.body;

    if (!amount) {
      return res.status(400).json({ msg: "Amount is required", status: false });
    }

    // Stripe expects amount in smallest currency unit (cents/cents equivalent)
    // For KES, Stripe uses the whole number (KES has no subunits in Stripe)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: currency,
      payment_method_types: ["card"],
      metadata: { integration: "qr-parking" },
    });

    // Save pending Stripe transaction to DB
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
    const status = paymentIntent.status === "succeeded" ? "success" : "failed";
    await prisma.transaction.updateMany({
      where: { stripePaymentId: paymentIntentId },
      data: { status },
    });
    res.json({ status, status: true });
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

/** Mark an M-Pesa transaction as failed (e.g. client-side timeout) */
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

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
