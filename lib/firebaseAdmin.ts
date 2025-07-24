import { initializeApp, getApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import {
  DocumentSnapshot,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";

type NormalizeDocOptionsParams = {
  hidePrivate?: boolean;
  schema?: Record<string, any>;
};

export const client = initDb();

function init() {
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

export function initDb() {
  return getFirestore(getApps().length ? getApp() : init());
}

export function initStorage() {
  return getStorage(getApps().length ? getApp() : init());
}

export async function get(dbPath: string) {
  const dbCollection = client.collection(dbPath);
  const docs = await dbCollection.orderBy("created", "desc").get();
  const normalizedDocs: Record<string, any>[] = [];

  docs.forEach((doc) => {
    const normalizedDoc = normalizeDoc(doc);
    normalizedDocs.push(normalizedDoc);
  });

  return normalizedDocs;
}

export async function getById(dbPath: string, id: string) {
  const dbCollection = client.collection(dbPath);
  const doc = await dbCollection.doc(id).get();

  if (!doc.exists) {
    throw new Error(`Document with ID ${id} does not exist in ${dbPath}`);
  }

  return normalizeDoc(doc);
}

// Normalize a Firestore document snapshot to JSON
export function normalizeDoc(
  doc: DocumentSnapshot | QueryDocumentSnapshot,
  options: NormalizeDocOptionsParams = { hidePrivate: true, schema: {} }
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
      } else if (value instanceof Timestamp) {
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

export async function patch(
  dbPath: string,
  id: string,
  data: Record<string, any>
): Promise<Record<string, any>> {
  const dbCollection = client.collection(dbPath);
  const docRef = dbCollection.doc(id);
  const doc = await docRef.get();

  if (!doc.exists) {
    throw new Error(`Document with ID ${id} does not exist in ${dbPath}`);
  }

  const sanitizedData = sanitizeForDb(data);
  sanitizedData.updated = Timestamp.now();
  await docRef.update(sanitizedData);
  const updatedDoc = await docRef.get();
  return normalizeDoc(updatedDoc);
}

export async function post(
  dbPath: string,
  data: Record<string, any>,
  user: Record<string, any>
) {
  const dbCollection = client.collection(dbPath);
  const sanitizedData = {
    ...sanitizeForDb(data),
    created: Timestamp.now(),
    updated: Timestamp.now(),
    authorId: user.uid,
  };
  const newDoc = await dbCollection.add(sanitizedData);
  const confirmDoc = await dbCollection.doc(newDoc.id).get();
  return normalizeDoc(confirmDoc);
}

export async function put(
  dbPath: string,
  id: string,
  data: Record<string, any>
): Promise<Record<string, any>> {
  const dbCollection = client.collection(dbPath);
  const docRef = dbCollection.doc(id);
  const doc = await docRef.get();

  if (!doc.exists) {
    throw new Error(`Document with ID ${id} does not exist in ${dbPath}`);
  }

  const sanitizedData = sanitizeForDb(data);
  sanitizedData.updated = Timestamp.now();
  await docRef.set(sanitizedData);
  const updatedDoc = await docRef.get();
  return normalizeDoc(updatedDoc);
}

export async function remove(dbPath: string, id: string): Promise<string> {
  const dbCollection = client.collection(dbPath);
  await dbCollection.doc(id).delete();
  return id;
}

// Sanitize before saving to db. Convert date strings to Date objects.
export function sanitizeForDb(obj: Record<string, any>) {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value?.toString().match(/^\d{4}-\d{2}-\d{2}/)) {
      sanitized[key] = new Date(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
