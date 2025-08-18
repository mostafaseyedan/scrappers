import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Single initialization guard
if (!getApps().length) {
  initializeApp();
  // Configure Firestore to ignore undefined to reduce noisy writes
  getFirestore().settings({ ignoreUndefinedProperties: true });
}

export const db = getFirestore();
