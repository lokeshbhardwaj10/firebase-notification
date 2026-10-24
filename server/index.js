
import "dotenv/config";
import express from "express";
import cors from "cors";
import { firebaseAdminReady, messaging } from "./firebase-admin.js";

const app = express();
const PORT = process.env.PORT || 5000;

// Temporary storage for registered browser tokens.
// Tokens are cleared whenever the backend restarts.
const registeredTokens = new Set();

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  })
);

app.use(express.json({ limit: "10kb" }));

// Check whether the backend is running.
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "Firebase Notification Demo API",
    registeredBrowsers: registeredTokens.size,
    firebaseAdminReady,
  });
});

// Register a browser's Firebase Cloud Messaging token.
app.post("/api/register-token", (req, res) => {
  const { token } = req.body ?? {};

  if (
    typeof token !== "string" ||
    token.length < 20 ||
    token.length > 4096
  ) {
    return res.status(400).json({
      error: "A valid FCM registration token is required.",
    });
  }

  const wasRegistered = registeredTokens.has(token);
  registeredTokens.add(token);

  return res.json({
    message: "Browser registered successfully.",
    registeredBrowsers: registeredTokens.size,
    alreadyRegistered: wasRegistered,
  });
});

// Send a push notification to all registered browsers.
app.post("/api/send", async (req, res) => {
  const { title, body } = req.body ?? {};

  if (
    typeof title !== "string" ||
    typeof body !== "string" ||
    !title.trim() ||
    !body.trim() ||
    title.length > 100 ||
    body.length > 500
  ) {
    return res.status(400).json({
      error: "Provide a title and message within the allowed lengths.",
    });
  }

  const tokens = [...registeredTokens];

  if (tokens.length === 0) {
    return res.status(400).json({
      error: "No browsers registered. Enable notifications first.",
    });
  }

  if (!firebaseAdminReady || !messaging) {
    return res.status(503).json({
      error: "Push delivery is unavailable. Check the backend Firebase service account configuration.",
    });
  }

  try {
    const result = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: title.trim(),
        body: body.trim(),
      },
      webpush: {
        notification: {
          icon: "/vite.svg",
        },
      },
    });

    // Remove tokens Firebase identifies as invalid or expired.
    result.responses.forEach((response, index) => {
      if (
        !response.success &&
        [
          "messaging/invalid-registration-token",
          "messaging/registration-token-not-registered",
        ].includes(response.error?.code)
      ) {
        registeredTokens.delete(tokens[index]);
      }
    });

    if (result.failureCount > 0) {
      console.warn(`Firebase delivery completed with ${result.failureCount} failed token(s).`);
    }

    return res.json({
      message: "Notification sending attempt completed.",
      successCount: result.successCount,
      failureCount: result.failureCount,
      registeredBrowsers: registeredTokens.size,
    });
  } catch (error) {
    console.error(`Firebase send failed (${error.code || error.name || "unknown-error"}).`);

    return res.status(500).json({
      error: "Firebase could not send the notification.",
    });
  }
});

app.use((error, _req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json({ error: "Request body must be valid JSON." });
  }
  console.error(`API request failed (${error.code || error.name || "unknown-error"}).`);
  return res.status(500).json({ error: "The server could not process this request." });
});

app.listen(PORT, () => {
  console.log(`Notification API running at http://localhost:${PORT}`);
});
