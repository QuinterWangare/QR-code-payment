# Smart QR Scan-to-Pay

A full-stack payment system where a customer scans a QR code and pays directly from their phone via **M-Pesa** (STK Push) — no app download required.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│  Customer's Phone                                            │
│   QR Scan → browser opens /payment-selection                 │
└──────────────┬───────────────────────────────────────────────┘
               │ HTTPS (ngrok free domain)
┌──────────────▼───────────────────────────────────────────────┐
│  Next.js Frontend  (port 3000)                               │
│   /payment-selection  →  /mpesa-payment                      │
│   /payment-success   |  /payment-failed                      │
│                                                              │
│   API Routes (server-side proxy — no CORS)                   │
│   POST /api/stkpush   →  localhost:5000/api/stkpush          │
│   POST /api/stkquery  →  localhost:5000/api/stkquery         │
│   POST /api/callback  ←  Daraja webhook (via ngrok)          │
│   GET  /api/payment-status/[id]                              │
└──────────────┬───────────────────────────────────────────────┘
               │ localhost
┌──────────────▼───────────────────────────────────────────────┐
│  Express Backend  (port 5000)                                │
│   POST /api/stkpush   — initiates STK Push                   │
│   POST /api/stkquery  — queries payment status               │
│   POST /api/callback  — receives Daraja result callback      │
│   GET  /              — health check                         │
└──────────────┬───────────────────────────────────────────────┘
               │ HTTPS
┌──────────────▼───────────────────────────────────────────────┐
│  Safaricom Daraja API (Sandbox)                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Payment Flow

1. Merchant displays a static QR code (generated on the admin page `/`).
2. Customer scans it — their browser opens `/payment-selection`.
3. Customer taps **M-Pesa**, enters their phone number, and presses **Pay**.
4. The frontend calls `/api/stkpush` (Next.js proxy) → Express → Daraja.
5. An STK Push prompt appears on the customer's phone.
6. Frontend polls `/api/stkquery` every 5 seconds (up to 90 s).
7. Daraja fires the result to the ngrok callback URL → `/api/callback` (Next.js) which stores it in an in-memory map with a 15-minute TTL.
8. The poll detects **success** → redirect to `/payment-success` with receipt details.
9. On failure the customer is redirected to `/payment-failed` with an actionable error message.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 18 |
| ngrok | free account with one reserved domain |
| Safaricom Daraja | sandbox credentials |

---

## Environment Variables

### Backend — `backend/.env`

```env
CONSUMER_KEY=your_daraja_consumer_key
CONSUMER_SECRET=your_daraja_consumer_secret
BUSINESS_SHORT_CODE=174379
PASS_KEY=your_daraja_sandbox_passkey
CALLBACK_URL=https://<your-ngrok-domain>/api/callback
PORT=5000
```

### Frontend — `frontend/.env.local`

```env
NEXT_PUBLIC_APP_URL=https://<your-ngrok-domain>
MPESA_BACKEND_URL=http://localhost:5000
```

---

## Setup & Running

### 1 — Install dependencies

```bash
cd backend  && npm install
cd ../frontend && npm install
```

### 2 — Start ngrok

```bash
ngrok http 3000
```

> The ngrok tunnel must point to **port 3000** (the Next.js frontend). Next.js API routes act as a secure server-side proxy to the Express backend.

### 3 — Start the backend

```bash
cd backend
node --env-file=.env app.js
```

### 4 — Start the frontend

```bash
cd frontend
npm run dev
```

### 5 — Verify

| URL | Expected |
|-----|----------|
| `http://localhost:5000/` | `{"status":"ok", ...}` |
| `http://localhost:3000/` | Admin QR code page |
| `https://<ngrok-domain>/` | Same, accessible from phone |

---

## Project Structure

```
.
├── backend/
│   ├── app.js          # Express server — all Daraja API logic
│   └── package.json
└── frontend/
    ├── app/
    │   ├── page.tsx                        # Admin: QR code generator
    │   ├── layout.tsx                      # Root layout + metadata
    │   ├── payment-selection/page.tsx      # Payment method chooser
    │   ├── mpesa-payment/page.tsx          # Phone entry + STK Push + polling
    │   ├── payment-success/page.tsx        # Receipt display
    │   ├── payment-failed/page.tsx         # Error display with guidance
    │   └── api/
    │       ├── stkpush/route.ts            # Proxy → backend /api/stkpush
    │       ├── stkquery/route.ts           # Proxy → backend /api/stkquery
    │       ├── callback/route.ts           # Receives Daraja webhook
    │       ├── payment-store.ts            # In-memory result store (TTL 15 min)
    │       └── payment-status/[id]/route.ts
    └── lib/
        └── mpesa-api.ts                    # Typed API client (fetch wrappers)
```

---

## Key Design Decisions

- **No CORS issues** — the browser only ever talks to the Next.js origin. The Express backend is localhost-only and never receives browser requests directly.
- **Stateless polling** — `sessionStorage` persists the `checkoutRequestId` across page refreshes, allowing seamless resumption of in-progress payments.
- **Typed API client** (`lib/mpesa-api.ts`) — all network logic lives in one module; UI components import `initiateStkPush` / `queryStkStatus` functions with full TypeScript types.
- **Resilient error handling** — 16 distinct failure codes mapped to user-friendly messages with actionable tips (wrong PIN, insufficient balance, duplicate transaction, timeouts, etc.).
- **TTL store** — payment results are auto-deleted after 15 minutes to avoid indefinite memory growth.
