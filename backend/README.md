# Mpesa Daraja API - Backend

An Express.js backend integrating the Safaricom Daraja API to handle M-Pesa STK Push payments.

---


## 1. Install Node.js & Environment Setup

### Install Node.js

**Option A – Using the official installer (recommended):**

1. Go to [https://nodejs.org](https://nodejs.org) and download the **LTS** version.
2. Run the installer and follow the prompts.
3. Verify the installation:

```bash
node -v
npm -v
```

### Install Project Dependencies

Navigate to the `backend` directory and install all required packages:

```bash
cd backend
npm install
```

This will install:

| Package       | Purpose                          |
|---------------|----------------------------------|
| `express`     | Web server framework             |
| `axios`       | HTTP client for Daraja API calls |
| `body-parser` | Parse incoming request bodies    |
| `cors`        | Enable cross-origin requests     |
| `moment`      | Timestamp formatting             |
| `nodemon`     | Auto-restart during development  |

---

## 2. Install & Set Up Ngrok

Ngrok exposes your local server to the internet so that Safaricom's servers can reach your `/callback` endpoint.

### Install Ngrok

1. Go to [https://ngrok.com](https://ngrok.com) and create a free account.
2. Download the ngrok binary for your OS from [https://ngrok.com/download](https://ngrok.com/download).

**On Linux (via apt):**

```bash
curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc \
  | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null \
  && echo "deb https://ngrok-agent.s3.amazonaws.com buster main" \
  | sudo tee /etc/apt/sources.list.d/ngrok.list \
  && sudo apt update \
  && sudo apt install ngrok
```

### Authenticate Ngrok

After signing up, get your auth token from the [ngrok dashboard](https://dashboard.ngrok.com/get-started/your-authtoken) and run:

```bash
ngrok config add-authtoken <YOUR_AUTH_TOKEN>
```

### Run Ngrok in the Project Directory

Make sure your backend server is running on port `5000`, then in a **separate terminal** from the `backend` directory:

```bash
ngrok http 5000
```

Ngrok will output a forwarding URL similar to:

```
Forwarding  https://xxxx-xxx-xxx-xxx.ngrok-free.app -> http://localhost:5000
```

Copy the `https://` URL — you will need it for the `CallBackURL` in [app.js](app.js):

```js
CallBackURL: " https://profligately-unflaming-vannesa.ngrok-free.dev",
```

> **Note:** The ngrok URL changes every time you restart ngrok (on the free plan). Update `CallBackURL` in `app.js` each time.

---

## 3. Get Daraja API Credentials

### Register on Safaricom Developer Portal

1. Go to [https://developer.safaricom.co.ke](https://developer.safaricom.co.ke) and create an account.
2. Log in and navigate to **My Apps**.
3. Click **Add a new App**, give it a name, and check both **Lipa Na M-Pesa Sandbox** and **M-Pesa Sandbox**.
4. Click **Create App**.

### Retrieve Your Credentials

From the app detail page, copy:

| Credential        | Where to use in `app.js`          |
|-------------------|----------------------------------|
| `Consumer Key`    | `consumer_key` variable          |
| `Consumer Secret` | `consumer_secret` variable       |

Update [app.js](app.js) with your credentials:

```js
const consumer_key = "YOUR_CONSUMER_KEY";
const consumer_secret = "YOUR_CONSUMER_SECRET";
```

### Get Your STK Push Test Credentials

From the Daraja portal, go to **APIs → Lipa Na M-Pesa Sandbox** to obtain:

| Credential          | Value / Where to find                        |
|---------------------|----------------------------------------------|
| `BusinessShortCode` | `174379` (sandbox default)                   |
| `Passkey`           | Listed under the Lipa Na M-Pesa sandbox tile |

The `Password` is generated at runtime by base64-encoding:  
`BusinessShortCode + Passkey + Timestamp`

---

## 4. Start the Server & Available Routes

### Start the Server

**Production / normal start:**

```bash
npm start
```

**Development mode (auto-restarts on file changes):**

```bash
npm run dev
```

The server runs at: `http://localhost:5000`

---

### Available Routes

#### `GET /`

Health check. Confirms the server is running.

```
http://localhost:5000/
```

**Response:**
```
********************  MPESA DARAJA API  ********************
```

---

#### `GET /access_token`

Fetches an OAuth access token from Safaricom using your `consumer_key` and `consumer_secret`.

```
http://localhost:5000/access_token
```

**Response:**
```
Your access token is <token_string>
```

> If this returns a token successfully, your API credentials are valid.

---

#### `GET /stkpush`

Initiates an M-Pesa STK Push prompt to the configured phone number.

```
http://localhost:5000/stkpush
```

**Prerequisites before calling this route:**
- The server must be running.
- Ngrok must be running and `CallBackURL` in `app.js` must be updated with the current ngrok URL.
- `consumer_key` and `consumer_secret` must be valid.

**Response on success:**
```
Request is successful done ✔✔. Please check your phone and enter mpesa pin to complete the transaction
```

The target phone number will receive an M-Pesa PIN prompt. The transaction result is sent to the `/callback` endpoint and saved to `stkcallback.json`.

---

### Other Route Still In Development
.....
