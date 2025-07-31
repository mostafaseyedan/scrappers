import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

export const app = initializeApp({
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
});

export const db = getFirestore(app);

// Normalize a Firestore document snapshot to JSON
export function normalizeDoc(
  doc: { data: () => any },
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
