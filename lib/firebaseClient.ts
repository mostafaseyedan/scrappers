import { getApp, getApps, initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  inMemoryPersistence,
  setPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { clientConfig } from "@/config/clientConfig";

// Single source of truth for client app init to avoid app/duplicate-app errors
export const app = getApps().length ? getApp() : initializeApp(clientConfig);

export const db = getFirestore(app);

export function getFirebaseAuth() {
  const auth = getAuth(app);

  // App relies only on server token. We make sure Firebase does not store credentials in the browser.
  // See: https://github.com/awinogrodzki/next-firebase-auth-edge/issues/143
  setPersistence(auth, inMemoryPersistence);

  if (process.env.NEXT_PUBLIC_AUTH_EMULATOR_HOST) {
    // https://stackoverflow.com/questions/73605307/firebase-auth-emulator-fails-intermittently-with-auth-emulator-config-failed
    (auth as unknown as any)._canInitEmulator = true;
    connectAuthEmulator(
      auth,
      `http://${process.env.NEXT_PUBLIC_AUTH_EMULATOR_HOST}`,
      {
        disableWarnings: true,
      }
    );
  }

  if (clientConfig.tenantId) {
    auth.tenantId = clientConfig.tenantId;
  }

  return auth;
}

// Normalize a Firestore document snapshot to JSON
export function normalizeDoc(
  doc: { data: () => any; id: string },
  options: Record<string, any> = { hidePrivate: true, schema: {} }
) {
  const docData = doc.data() || {};
  const currentDoc: Record<string, any> = {};

  for (const field of Object.keys(docData)) {
    const value = docData[field];

    // Field names that starts with _ are private and will not be shown unless overriden
    const show =
      (options.hidePrivate === false && field.startsWith("_")) ||
      !field.startsWith("_");
    if (show) {
      if (value?._latitude && value?._longitude) {
        currentDoc[field] = { lat: value._latitude, lng: value._longitude };
      } else if (value.seconds) {
        currentDoc[field] = value.toDate();
      } else {
        currentDoc[field] = value;
      }
    }
  }

  const { created, updated } = docData;
  const sanitizedDoc: Record<string, any> = {
    ...currentDoc,
    id: doc.id,
    updated: updated.toDate(),
  };
  if (created) sanitizedDoc.created = created.toDate();

  return sanitizedDoc;
}

export function parseQueryValue(value: string) {
  if (value === "false") {
    return false;
  }

  if (value === "true") {
    return true;
  }

  if (value.match(/^\d{4}-\d{2}-\d{2}/)) {
    return new Date(value);
  }

  return value;
}
