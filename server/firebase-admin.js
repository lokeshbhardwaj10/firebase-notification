
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

if (!fs.existsSync(credentialsPath)) {
  throw new Error(
    `Firebase service account file not found: ${credentialsPath}`
  );
}

const serviceAccount = JSON.parse(
  fs.readFileSync(credentialsPath, "utf8")
);

const firebaseApp =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert(serviceAccount),
      });

export const messaging = getMessaging(firebaseApp);
