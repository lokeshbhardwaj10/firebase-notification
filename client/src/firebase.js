
import { initializeApp, getApps } from "firebase/app";
import { getMessaging, isSupported } from "firebase/messaging";

export const firebaseConfig = Object.freeze({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

const requiredConfig = ["apiKey", "authDomain", "projectId", "messagingSenderId", "appId"];
export const firebaseConfigMissing = requiredConfig.filter((key) => !firebaseConfig[key]);
export const isFirebaseConfigured = firebaseConfigMissing.length === 0;
export const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
export const firebaseApp = isFirebaseConfigured
  ? getApps()[0] || initializeApp(firebaseConfig)
  : null;

export async function getFirebaseMessaging() {
  if (!isFirebaseConfigured || !firebaseApp) {
    throw new Error("Firebase is not configured. Check the client environment variables.");
  }

  if (!(await isSupported())) {
    throw new Error("This browser does not support Firebase push notifications.");
  }

  return getMessaging(firebaseApp);
}

export function getServiceWorkerUrl() {
  const workerConfig = new URLSearchParams(
    Object.entries(firebaseConfig).filter(([, value]) => Boolean(value)),
  );
  return `/firebase-messaging-sw.js?${workerConfig.toString()}`;
}
