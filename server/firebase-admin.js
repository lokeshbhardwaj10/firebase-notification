
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  initializeApp,
  cert,
  getApps,
} from "firebase-admin/app";

import { getMessaging } from "firebase-admin/messaging";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

const credentialsPath = path.resolve(
  currentDir,
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    "./service-account.json"
);

export let messaging = null;
export let firebaseAdminReady = false;

try {
  if (!fs.existsSync(credentialsPath)) {
    throw new Error("service-account-file-not-found");
  }

  const serviceAccount = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
  if (
    !serviceAccount ||
    typeof serviceAccount.project_id !== "string" ||
    typeof serviceAccount.client_email !== "string" ||
    typeof serviceAccount.private_key !== "string"
  ) {
    throw new Error("service-account-fields-invalid");
  }

  const firebaseApp =
    getApps().length > 0
      ? getApps()[0]
      : initializeApp({ credential: cert(serviceAccount) });

  messaging = getMessaging(firebaseApp);
  firebaseAdminReady = true;
} catch (error) {
  const knownDiagnostics = ["service-account-file-not-found", "service-account-fields-invalid"];
  const diagnostic = error instanceof SyntaxError
    ? "service-account-json-invalid"
    : knownDiagnostics.includes(error.message)
      ? error.message
      : error.code || error.name || "unknown-configuration-error";
  console.error(`Firebase Admin is unavailable (${diagnostic}). Check server credentials configuration.`);
}
