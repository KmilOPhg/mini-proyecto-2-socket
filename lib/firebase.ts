import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import admin from "firebase-admin";
import type { ServiceAccount } from "firebase-admin/app";

const globalForFirebase = globalThis as unknown as {
  firebaseApp?: admin.app.App;
};

function parseServiceAccount(raw: string): ServiceAccount {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    return JSON.parse(trimmed) as ServiceAccount;
  }
  const filePath = resolve(process.cwd(), trimmed);
  const json = readFileSync(filePath, "utf-8");
  return JSON.parse(json) as ServiceAccount;
}

export function getFirebaseApp(): admin.app.App {
  if (globalForFirebase.firebaseApp) return globalForFirebase.firebaseApp;
  if (admin.apps.length > 0) {
    globalForFirebase.firebaseApp = admin.app();
    return globalForFirebase.firebaseApp;
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (raw) {
    const parsed = parseServiceAccount(raw);
    admin.initializeApp({ credential: admin.credential.cert(parsed) });
  } else {
    admin.initializeApp();
  }

  globalForFirebase.firebaseApp = admin.app();
  return globalForFirebase.firebaseApp;
}

export function getDb(): admin.firestore.Firestore {
  return admin.firestore(getFirebaseApp());
}

export function getAuth(): admin.auth.Auth {
  return admin.auth(getFirebaseApp());
}
