# Firebase Push Notification Demo

A local demo of Firebase Cloud Messaging (FCM) using React + Vite, Express, and Firebase Admin. The client can register its browser token, send a notification to all tokens held by the backend, display foreground messages in the dashboard, and handle background messages with a service worker.

## Requirements

- Node.js compatible with the installed Vite version (Node 20.19+ or 22.12+ recommended)
- A Firebase project with a registered Web app
- A Firebase service account JSON file for the backend
- A browser that supports the Firebase Messaging APIs; local development on `localhost` is treated as a secure context

## Firebase setup

1. In Firebase Console, open **Project settings > General** and register a Web app. Copy its web app configuration values into `client/.env`.
2. In **Project settings > Cloud Messaging**, enable the Firebase Cloud Messaging API if prompted, then create or view a **Web Push certificate** key pair. Copy the public key into `VITE_FIREBASE_VAPID_KEY`.
3. In **Project settings > Service accounts**, generate a private key JSON for the backend. Put the downloaded file at `server/service-account.json`. Do not paste the private key into source code, frontend variables, chat, or the README.
4. Keep the Web app configuration and service account pointed at the same Firebase project.

The Firebase Web app configuration and VAPID key are public client configuration, not server secrets. Never place service-account credentials in `client/`, a `VITE_*` variable, or the service worker source.

## Configure environment

Copy the placeholder files:

```powershell
if (!(Test-Path client/.env)) { Copy-Item client/.env.example client/.env }
if (!(Test-Path server/.env)) { Copy-Item server/.env.example server/.env }
```

Fill in `client/.env` with the Firebase Web app values and public VAPID key. `VITE_API_URL` defaults to `http://localhost:5000`. In `server/.env`, set `CLIENT_ORIGIN` to the exact frontend origin and optionally set `FIREBASE_SERVICE_ACCOUNT_PATH` (relative paths are resolved from the `server` directory; the default is `./service-account.json`).

Vite reads client environment variables at startup. **Restart the Vite dev server after changing `client/.env`.** Restart the backend after changing `server/.env`.

## Install and run

Install dependencies once in each application directory:

```powershell
cd D:\demofirebase\server
npm install

cd D:\demofirebase\client
npm install
```

Run these in separate VS Code terminals:

```powershell
cd D:\demofirebase\server
npm run dev
```

```powershell
cd D:\demofirebase\client
npm run dev
```

Open the dashboard at [http://localhost:5173](http://localhost:5173). Check backend status at [http://localhost:5000/api/health](http://localhost:5000/api/health).

## Using the dashboard

1. Confirm the API and Firebase project status are ready.
2. Select **Enable browser notifications**. Browser permission is requested only after this click. Grant permission to create and register the FCM token.
3. Keep the dashboard open and use **Send notification** to send a test message. The response reports successful and failed deliveries.
4. A foreground message appears in the activity history. When the page is backgrounded or closed, the service worker displays notification payloads where the browser supports background push. Selecting a notification focuses the app or opens it.

Notifications require a supported browser, notification permission, a valid Firebase Web app config, and a valid VAPID key. The browser must be served from localhost or HTTPS. Permission denied by the browser must be reset in the browser's site settings.

## API

- `GET /api/health` returns service status, Firebase Admin readiness, and the number of in-memory registered browsers.
- `POST /api/register-token` accepts `{ "token": "..." }` and idempotently adds the token.
- `POST /api/send` accepts `{ "title": "...", "body": "..." }` and returns `successCount`, `failureCount`, and the remaining registered browser count.

Titles are limited to 100 characters and messages to 500 characters. Invalid or expired FCM tokens are removed after a send attempt. An empty token list returns a client error; unavailable Admin credentials return a service-unavailable response without exposing credential details.

## Storage and security

This demo stores FCM tokens in a JavaScript `Set` in server memory. **Restarting the backend clears all registered tokens**, so re-register the browser after a restart.

The API intentionally has no authentication, database, or rate limiting. **Do not expose these endpoints publicly** without authentication, rate limiting, abuse protection, and an appropriate token-storage/retention policy. CORS is limited to `CLIENT_ORIGIN`, but CORS is not authentication. Keep `server/service-account.json`, `server/.env`, and `client/.env` private; the root `.gitignore` excludes them. Verify with `git status` before committing, especially if a secret was tracked before being ignored.

## Checks

```powershell
cd D:\demofirebase\client
npm run lint
npm run build
```

The server package does not currently define automated tests. Use `/api/health` and submit invalid API payloads to verify validation. A real push delivery can only be verified after Firebase is configured and a browser token is registered; no credentials or real push should be assumed from a successful build alone.
