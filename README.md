# Smart QR Scan-To-Pay

A parking payment system that lets users scan a QR code and pay via **M-Pesa** or **Visa (Stripe)**. Transactions are persisted in a local SQLite database.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Project Setup](#project-setup)
- [Running the Project](#running-the-project)
- [Testing M-Pesa Payment](#testing-m-pesa-payment)
- [Testing Visa Payment](#testing-visa-payment)
- [Viewing Transactions](#viewing-transactions)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Make sure the following are installed on your machine:

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | v18+ | `node -v` to check |
| npm | v9+ | comes with Node.js |
| ngrok | any | [ngrok.com/download](https://ngrok.com/download) — required for M-Pesa callbacks |

---

## Project Setup

### 1. Backend — `backend/.env`

Create `backend/.env` with the following variables:

```env
BACKEND_NGROK_URL=https://your-ngrok-url.ngrok-free.app   # update after starting ngrok
STRIPE_SECRET_KEY=sk_test_...                              # your Stripe secret key
DATABASE_URL="file:./dev.db"
```

### 2. Frontend — `frontend/.env.local`

Create `frontend/.env.local` with:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
BACKEND_URL=http://localhost:5000
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...             # your Stripe publishable key
```

### 3. Install dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 4. Set up the database

Run this once from the `backend/` directory to create the SQLite database and apply migrations:

```bash
cd backend
npx prisma migrate dev --name init
npx prisma generate
```

---

## Running the Project

You need **three terminals** running simultaneously.

### Terminal 1 — Backend

```bash
cd backend
npm start
```

Server starts at **http://localhost:5000**

### Terminal 2 — Frontend

```bash
cd frontend
npm run dev
```

App starts at **http://localhost:3000**

### Terminal 3 — ngrok (required for M-Pesa callbacks)

```bash
ngrok http 5000
```

Copy the `https://xxxx.ngrok-free.app` URL it gives you, then update `BACKEND_NGROK_URL` in `backend/.env` and **restart the backend**.

> **Note:** ngrok URLs change every time you restart ngrok. Always update `.env` and restart the backend when this happens.

---

## Testing M-Pesa Payment

M-Pesa uses the **Safaricom Daraja Sandbox**. Real sandbox STK Push prompts are sent to Safaricom test numbers.

### Step-by-step

1. Open **http://localhost:3000** in your browser.
2. You will see a QR code — scan it or click the link directly.
3. On the **Payment Selection** page, choose **M-Pesa**.
4. Enter your **Safaricom phone number** (the 9 digits after `+254`).
   - Example: if your number is `0712 345 678`, enter `712345678`
5. Tap **Pay Ksh 10 with M-Pesa**.
6. You will see **"Sending prompt..."** briefly, then **"Waiting for PIN... 90s"**.
7. Check your phone — you will receive an **M-Pesa STK Push notification**.
8. Enter your **M-Pesa PIN** on your phone.
9. The app polls for confirmation every 3 seconds. On success it automatically redirects to the **Payment Success** page.

### Timeout behaviour

- If no PIN is entered within **90 seconds**, the app marks the transaction as **failed** in the database and redirects back to the home page.
- If you cancel the prompt on your phone, the app detects the cancellation and shows an error immediately.

### What to expect on success

```
✅ Payment Successful
M-Pesa  •  Ksh 10
```

---

## Testing Visa Payment

Visa payments use **Stripe in test mode**. No real card is charged.

### Step-by-step

1. Open **http://localhost:3000** in your browser.
2. Scan the QR code or follow the link.
3. On the **Payment Selection** page, choose **Visa / Card**.
4. The card payment form appears with Stripe Elements.
5. Fill in the test card details below:

### Test Card Details

| Field | Value |
|-------|-------|
| **Card Number** | `4242 4242 4242 4242` |
| **Expiry Date** | `12 / 26` (any future date) |
| **CVC** | `123` (any 3 digits) |
| **ZIP / Postal Code** | `12345` (any 5 digits) |

6. Click **Pay Now**.
7. Stripe processes the payment and redirects to the **Payment Success** page.

### What to expect on success

```
✅ Payment Successful
Visa  •  Ksh 10
```

### Other Stripe test scenarios

| Card Number | Behaviour |
|-------------|-----------|
| `4242 4242 4242 4242` | Payment succeeds |
| `4000 0000 0000 0002` | Payment declined |
| `4000 0025 0000 3155` | Requires 3D Secure authentication |

> Full list of test cards: [stripe.com/docs/testing](https://stripe.com/docs/testing)

---

## Viewing Transactions

### Via API

```bash
curl http://localhost:5000/api/transactions
```

Returns all transactions ordered by most recent first.

### Via Prisma Studio (visual UI)

```bash
cd backend
npx prisma studio
```

Opens a web UI at **http://localhost:5555** where you can browse, filter, and inspect every transaction in the database.

### Transaction statuses

| Status | Meaning |
|--------|---------|
| `pending` | STK push sent / payment initiated, awaiting confirmation |
| `success` | Payment confirmed and complete |
| `failed` | Cancelled, declined, or timed out |

---

## Troubleshooting

### Port 5000 already in use

```bash
fuser -k 5000/tcp
```

Then run `npm start` again.

### M-Pesa STK Push not arriving

- Confirm ngrok is running and `BACKEND_NGROK_URL` in `backend/.env` matches the current ngrok URL.
- Restart the backend after updating the URL.
- Check the backend terminal for any `403` or access token errors.

### App stuck on "Waiting for PIN"

- Confirm the backend is running on port 5000.
- Check that ngrok is running so Safaricom can reach the `/api/callback` endpoint.
- The app auto-redirects home after 90 seconds if no confirmation is received.

### Stripe payment fails immediately

- Confirm `STRIPE_SECRET_KEY` (backend) and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (frontend) are both set and match the same Stripe account.
- Make sure you are using **test mode keys** (they start with `sk_test_` and `pk_test_`).

