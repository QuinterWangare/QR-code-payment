# API Contracts — Smart QR Scan-to-Pay

> **Stack:** Next.js 15 frontend (port 3000) · Express backend (port 5000) · SQLite via Prisma · Safaricom Daraja API · Stripe

---

## Architecture Overview

```
Browser / QR Scanner
       │
       ▼
Next.js Frontend  (:3000)
  /api/* routes  ──────────── proxy ──────────────▶  Express Backend  (:5000)
       │                                                     │
       │  /api/callback  ◀── Safaricom STK callback          │── Safaricom Daraja
       │  /api/payment-status/:id  (in-memory store)         │── Stripe
       │                                                     │── SQLite (Prisma)
       ▼
   Frontend Pages
```

**All frontend-to-backend calls go through Next.js `/api/*` proxy routes.**  
**External services (Safaricom, Stripe) reach the backend directly.**

---

## All Available Endpoints

### Frontend Proxy Routes (called by browser, port 3000)

| Method | URL | Called by | Purpose |
|--------|-----|-----------|---------|
| `POST` | `/api/stkpush` | M-Pesa payment page | Trigger M-Pesa STK Push prompt |
| `POST` | `/api/stkquery` | M-Pesa payment page | Poll STK transaction status (Safaricom + callback store) |
| `POST` | `/api/callback` | **Safaricom** (automatic) | Receive M-Pesa STK callback; persist result in memory |
| `GET`  | `/api/payment-status/:checkoutRequestId` | M-Pesa payment page | Read in-memory callback result (one-shot read & delete) |
| `GET`  | `/api/mpesa-status/:checkoutRequestId` | M-Pesa payment page | Read DB-persisted M-Pesa status |
| `POST` | `/api/mpesa-timeout` | M-Pesa payment page | Mark a pending M-Pesa transaction as failed/timed-out |
| `POST` | `/api/create-payment-intent` | Visa payment page | Create a Stripe PaymentIntent (Visa/card) |
| `POST` | `/api/stripe-confirm` | Visa payment page | Confirm whether Stripe payment succeeded |

### Backend Direct Routes (Express, port 5000)

| Method | URL | Called by | Purpose |
|--------|-----|-----------|---------|
| `GET`  | `/` | Anyone / health checks | Verify server is alive |
| `GET`  | `/access_token` | Dev / debugging | Validate Safaricom credentials (returns token preview) |
| `POST` | `/api/stkpush` | Frontend proxy | Process STK Push request to Safaricom |
| `POST` | `/api/stkquery` | Frontend proxy | Query STK transaction status from Safaricom |
| `POST` | `/api/callback` | Safaricom (automatic) | Receive M-Pesa STK callback; update DB |
| `POST` | `/callback` | Safaricom (legacy alias) | Same as above |
| `GET`  | `/api/payment-status/:checkoutRequestId` | Frontend proxy | Read in-memory result (backend copy) |
| `GET`  | `/api/mpesa-status/:checkoutRequestId` | Frontend proxy | Read DB-persisted M-Pesa status |
| `POST` | `/api/mpesa-timeout` | Frontend proxy | Mark pending M-Pesa tx as failed in DB |
| `POST` | `/api/create-payment-intent` | Frontend proxy | Create Stripe PaymentIntent |
| `POST` | `/api/stripe-confirm` | Frontend proxy | Confirm Stripe payment from DB |
| `GET`  | `/api/transactions` | Dev / debugging | List all transactions (newest first) |

---

## M-Pesa Endpoints

### `POST /api/stkpush`

Sends an STK Push prompt to the customer's phone. The customer then enters their M-Pesa PIN to complete payment.

**Request body**
```json
{
  "phone": "0712345678",
  "amount": 500,
  "accountNumber": "QR-PAY-001"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `phone` | string | ✅ | Accepts `07XXXXXXXX` — automatically normalised to `254XXXXXXXX` |
| `amount` | number | ✅ | Must be a positive number (KES) |
| `accountNumber` | string | ❌ | Defaults to `"QR-PAY"` if omitted |

**Success response — `200 OK`**
```json
{
  "status": true,
  "checkoutRequestId": "ws_CO_04032026123456789",
  "msg": "STK prompt sent. Please enter your M-Pesa PIN."
}
```

**Error response — `400 Bad Request`**
```json
{
  "status": false,
  "reason": "duplicate_transaction",
  "msg": "A payment to this number is already being processed. Wait 1-2 minutes for it to expire, then try again."
}
```

> After a successful STK Push, poll with [`POST /api/stkquery`](#post-apistkquery) or [`GET /api/payment-status/:checkoutRequestId`](#get-apipayment-statuscheckoutrequestid) to resolve the final status.

---

### `POST /api/stkquery`

Polls the current status of an STK Push transaction. The frontend route checks the in-memory callback store first (fast path), then falls back to querying Safaricom directly.

**Request body**
```json
{
  "checkoutRequestId": "ws_CO_04032026123456789"
}
```

**Possible responses**

| `status` | Meaning |
|----------|---------|
| `"success"` | PIN entered, payment completed |
| `"pending"` | Still waiting for user action |
| `"failed"` | Transaction failed (see `reason` + `message`) |

**Pending response — `200 OK`**
```json
{
  "status": "pending"
}
```

**Success response — `200 OK`**
```json
{
  "status": "success"
}
```

**Failed response — `200 OK`**
```json
{
  "status": "failed",
  "reason": "wrong_pin",
  "message": "Incorrect M-Pesa PIN entered. Please try again with your correct 4-digit PIN."
}
```

#### M-Pesa failure reason codes

| `reason` | When it occurs |
|----------|---------------|
| `insufficient_balance` | Account balance too low |
| `below_minimum` | Amount below M-Pesa minimum |
| `above_maximum` | Amount exceeds M-Pesa maximum |
| `daily_limit` | Would exceed daily transfer limit |
| `below_min_balance` | Would leave account below minimum balance |
| `invalid_sender` | Sender M-Pesa account unverified |
| `invalid_receiver` | Merchant (recipient) account invalid |
| `invalid_account` | Account not enabled for this transaction type |
| `internal_error` | Safaricom internal error (temporary) |
| `subscriber_locked` | Another transaction already in progress |
| `duplicate_transaction` | Duplicate request rejected |
| `cancelled` | User dismissed the STK prompt |
| `timeout` | STK prompt expired before PIN entry |
| `wrong_pin` | Incorrect PIN entered |

---

### `POST /api/callback`

**Called automatically by Safaricom** — do not call manually from the frontend.

Receives the STK Push callback from Safaricom after the user acts on the payment prompt. On the frontend, this stores the result in an in-memory map (with a 15-minute TTL). On the backend, it also updates the SQLite database.

**Safaricom callback body (success)**
```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "abc-123",
      "CheckoutRequestID": "ws_CO_04032026123456789",
      "ResultCode": 0,
      "ResultDesc": "The service request is processed successfully.",
      "CallbackMetadata": {
        "Item": [
          { "Name": "Amount",             "Value": 500 },
          { "Name": "MpesaReceiptNumber", "Value": "RGH7YKZ210" },
          { "Name": "Balance" },
          { "Name": "TransactionDate",    "Value": 20260304123000 },
          { "Name": "PhoneNumber",        "Value": 254712345678 }
        ]
      }
    }
  }
}
```

**Response to Safaricom — `200 OK`**
```json
{
  "ResultCode": 0,
  "ResultDesc": "Accepted"
}
```

---

### `GET /api/payment-status/:checkoutRequestId`

Reads the in-memory result populated by `/api/callback`. **One-shot** — the entry is deleted after being read.

**Parameters**

| Param | Type | Description |
|-------|------|-------------|
| `checkoutRequestId` | string (path) | The `checkoutRequestId` returned by `/api/stkpush` |

**Pending response — `200 OK`** (result not yet in store)
```json
{
  "status": "pending"
}
```

**Success response — `200 OK`**
```json
{
  "status": "success",
  "amount": 500,
  "receiptNumber": "RGH7YKZ210",
  "phone": "254712345678"
}
```

**Failed response — `200 OK`**
```json
{
  "status": "failed",
  "reason": "cancelled",
  "message": "You dismissed the M-Pesa payment prompt."
}
```

---

### `GET /api/mpesa-status/:checkoutRequestId`

Reads the **database-persisted** M-Pesa transaction status. Unlike `/api/payment-status`, this endpoint is non-destructive and reflects the state written by the backend callback handler.

**Parameters**

| Param | Type | Description |
|-------|------|-------------|
| `checkoutRequestId` | string (path) | M-Pesa `CheckoutRequestID` |

**Response — `200 OK`**
```json
{
  "status": "success",
  "mpesaReceiptNumber": "RGH7YKZ210"
}
```

Possible `status` values: `"pending"` · `"success"` · `"failed"`

---

### `POST /api/mpesa-timeout`

Marks a pending M-Pesa transaction as `"failed"` in the database when the frontend polling timer expires without resolution.

**Request body**
```json
{
  "checkoutRequestId": "ws_CO_04032026123456789"
}
```

**Response — `200 OK`**
```json
{
  "status": true
}
```

---

## Visa / Card Endpoints (Stripe)

### `POST /api/create-payment-intent`

Creates a Stripe PaymentIntent and returns the `clientSecret` needed by Stripe.js / React Stripe Elements on the frontend to render the card form and handle 3DS.

**Request body**
```json
{
  "amount": 500,
  "currency": "kes"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `amount` | number | ✅ | Amount in KES (converted to smallest unit × 100 internally) |
| `currency` | string | ❌ | ISO currency code, defaults to `"kes"` |

**Success response — `200 OK`**
```json
{
  "status": true,
  "clientSecret": "pi_3xxx_secret_yyy",
  "paymentIntentId": "pi_3xxxxxxxxxxxxxxxxxxxx"
}
```

**Error response — `400 Bad Request`**
```json
{
  "status": false,
  "msg": "Amount is required"
}
```

> Use `clientSecret` with `stripe.confirmCardPayment()` or the Stripe Elements SDK. Save `paymentIntentId` to confirm status afterwards.

---

### `POST /api/stripe-confirm`

Retrieves the Stripe PaymentIntent from the Stripe API and confirms whether payment succeeded. Call this after Stripe's client-side confirmation resolves.

**Request body**
```json
{
  "paymentIntentId": "pi_3xxxxxxxxxxxxxxxxxxxx"
}
```

**Success response — `200 OK`**
```json
{
  "status": "success",
  "ok": true
}
```

**Failed response — `200 OK`**
```json
{
  "status": "failed",
  "ok": true
}
```

**Error response — `500 Internal Server Error`**
```json
{
  "status": false,
  "msg": "No such payment_intent: 'pi_xxx'"
}
```

---

## Debug / Utility Endpoints

### `GET /` — Backend health check

```json
{
  "status": "ok",
  "service": "Smart QR Pay — M-Pesa Backend",
  "timestamp": "2026-03-04T12:00:00.000Z"
}
```

### `GET /access_token` — Validate Safaricom credentials

Returns a preview of the OAuth token to confirm keys are valid without exposing the full token.

```json
{
  "status": "ok",
  "hint": "Credentials are valid",
  "tokenPreview": "eEuMV2bxGPwQ…"
}
```

### `GET /api/transactions` — List all transactions

Returns all transactions ordered newest-first.

**Response — `200 OK`**
```json
{
  "status": true,
  "transactions": [
    {
      "id": 42,
      "method": "mpesa",
      "status": "success",
      "amount": 500.0,
      "currency": "KES",
      "phone": "254712345678",
      "checkoutRequestId": "ws_CO_04032026123456789",
      "mpesaReceiptNumber": "RGH7YKZ210",
      "stripePaymentId": null,
      "accountReference": "QR-PAY",
      "description": "QR Parking Payment",
      "createdAt": "2026-03-04T12:00:00.000Z",
      "updatedAt": "2026-03-04T12:01:05.000Z"
    },
    {
      "id": 41,
      "method": "visa",
      "status": "success",
      "amount": 1200.0,
      "currency": "KES",
      "phone": null,
      "checkoutRequestId": null,
      "mpesaReceiptNumber": null,
      "stripePaymentId": "pi_3xxxxxxxxxxxxxxxxxxxx",
      "accountReference": null,
      "description": "QR Parking Payment - Card",
      "createdAt": "2026-03-04T11:50:00.000Z",
      "updatedAt": "2026-03-04T11:50:30.000Z"
    }
  ]
}
```

---

## Standard Error Response Format

All endpoints return errors in this shape:

```json
{
  "status": false,
  "msg": "Human-readable error description"
}
```

Global unhandled errors from the Express backend return `500`:
```json
{
  "status": false,
  "msg": "An unexpected server error occurred."
}
```

---

## Data Model — Transaction

> Defined in `backend/prisma/schema.prisma`

| Field | Type | Notes |
|-------|------|-------|
| `id` | Int (PK) | Auto-increment |
| `method` | String | `"mpesa"` or `"visa"` |
| `status` | String | `"pending"` · `"success"` · `"failed"` |
| `amount` | Float | Payment amount |
| `currency` | String | Defaults to `"KES"` |
| `phone` | String? | M-Pesa phone number (normalised to `254XXXXXXXX`) |
| `checkoutRequestId` | String? | Safaricom `CheckoutRequestID` |
| `mpesaReceiptNumber` | String? | M-Pesa receipt number on success |
| `stripePaymentId` | String? | Stripe `PaymentIntent` ID |
| `accountReference` | String? | M-Pesa account reference label |
| `description` | String? | Free-text description |
| `createdAt` | DateTime | Auto-set on create |
| `updatedAt` | DateTime | Auto-updated on every write |

---

## Frontend Payment Flows

### M-Pesa flow (page: `/mpesa-payment`)

```
1.  User enters phone + amount
2.  POST /api/stkpush  →  receive { checkoutRequestId }
3.  Poll every ~3 s:
      POST /api/stkquery  →  { status: "pending" | "success" | "failed" }
    OR
      GET  /api/payment-status/:checkoutRequestId  (callback fast path)
4a. status === "success"  →  redirect to /payment-success
4b. status === "failed"   →  redirect to /payment-failed?reason=<reason>
4c. polling timer expires →  POST /api/mpesa-timeout  →  redirect to /payment-failed
```

### Visa / Card flow (page: `/visa-payment`)

```
1.  User enters card details via Stripe Elements
2.  POST /api/create-payment-intent  →  receive { clientSecret, paymentIntentId }
3.  stripe.confirmCardPayment(clientSecret)   ← Stripe JS SDK handles 3DS
4.  POST /api/stripe-confirm  { paymentIntentId }
      →  { status: "success" | "failed" }
5a. status === "success"  →  redirect to /payment-success
5b. status === "failed"   →  redirect to /payment-failed
```

---

## Environment Variables

### Backend (`.env` in `backend/`)

| Variable | Description |
|----------|-------------|
| `PORT` | Express server port (default `5000`) |
| `DATABASE_URL` | SQLite URL e.g. `file:./dev.db` |
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_test_…`) |
| `BACKEND_NGROK_URL` | Public ngrok URL used as M-Pesa `CallBackURL` |

### Frontend (`.env.local` in `frontend/`)

| Variable | Description |
|----------|-------------|
| `BACKEND_URL` | Express backend URL e.g. `http://localhost:5000` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (`pk_test_…`) |

---

## Quick Reference — Generating a Transaction Reference

> Used internally — the backend uses Safaricom's `CheckoutRequestID` and Stripe's `PaymentIntentID` as transaction identifiers. If you need a client-side ref for logging, use:

```typescript
import { v4 as uuidv4 } from 'uuid';

const transactionRef = `TXN-${uuidv4()}`;
// e.g. "TXN-a3bb9c00-f716-4f05-b9a4-5e9e4d1a3f22"
```
