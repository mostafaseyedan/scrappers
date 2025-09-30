import { initializeApp, getApp, getApps, cert } from "firebase-admin/app";
import {
  getFirestore,
  OrderByDirection,
  Timestamp,
} from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAuth } from "firebase-admin/auth";
import {
  DocumentSnapshot,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import queryString from "query-string";

type NormalizeDocOptionsParams = {
  hidePrivate?: boolean;
  schema?: Record<string, any>;
};

type GetOptions = {
  limit?: string | number | null;
  page?: string | number | null;
  sort?: string | null;
  filters?: Record<string, any>;
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

export function initAuth() {
  return getAuth(getApps().length ? getApp() : init());
}

export function initDb() {
  return getFirestore(getApps().length ? getApp() : init());
}

export function initStorage() {
  return getStorage(getApps().length ? getApp() : init());
}

export async function count(
  dbPath: string,
  options: { filters?: Record<string, any> } = {}
) {
  const filters = options?.filters || {};
  const collectionRef = client.collection(dbPath);
  let queryChain: FirebaseFirestore.Query = collectionRef;

  const rawFilterItems = Object.entries(filters);
  const filterItems = [];
  if (rawFilterItems.length > 0) {
    for (const [field, value] of rawFilterItems) {
      if (value.includes(" AND ")) {
        const values = value.split(" AND ");
        for (const val of values) {
          // > or < operators
          if (val.match(/^[><=]+ /)) {
            const [operator, finalVal] = val.split(" ");
            filterItems.push({
              field,
              operator: operator,
              value: parseQueryValue(finalVal),
            });
          } else {
            filterItems.push({
              field,
              operator: "==",
              value: parseQueryString(val),
            });
          }
        }
      } else {
        filterItems.push({
          field,
          operator: "==",
          value: parseQueryValue(value as string),
        });
      }
    }
  }
  for (const filterItem of filterItems) {
    queryChain = queryChain.where(
      filterItem.field,
      filterItem.operator,
      filterItem.value
    );
  }

  const snapshot = await queryChain.count().get();
  return snapshot.data().count;
}

export async function countColGroup(
  dbPath: string,
  options: { filters?: Record<string, any> } = {}
) {
  const filters = options?.filters || {};
  const collectionRef = client.collectionGroup(dbPath);
  let queryChain: FirebaseFirestore.Query = collectionRef;

  const rawFilterItems = Object.entries(filters);
  const filterItems = [];
  if (rawFilterItems.length > 0) {
    for (const [field, value] of rawFilterItems) {
      if (value.includes(" AND ")) {
        const values = value.split(" AND ");
        for (const val of values) {
          // > or < operators
          if (val.match(/^[><=]+ /)) {
            const [operator, finalVal] = val.split(" ");
            filterItems.push({
              field,
              operator: operator,
              value: parseQueryValue(finalVal),
            });
          } else {
            filterItems.push({
              field,
              operator: "==",
              value: parseQueryString(val),
            });
          }
        }
      } else {
        filterItems.push({
          field,
          operator: "==",
          value: parseQueryValue(value as string),
        });
      }
    }
  }
  for (const filterItem of filterItems) {
    queryChain = queryChain.where(
      filterItem.field,
      filterItem.operator,
      filterItem.value
    );
  }

  const snapshot = await queryChain.count().get();
  return snapshot.data().count;
}

export function parseQueryString(url: string) {
  const qIndex = url.indexOf("?");

  if (qIndex === -1) {
    return {};
  }

  const query = queryString.parse(url.substring(qIndex), {
    arrayFormat: "bracket",
  });
  const queryObj: any = {};

  for (const key of Object.keys(query)) {
    const value = query[key];
    let currNode = queryObj;

    // Converts query names with dots into values
    if (key.includes(".")) {
      const keyParts = key.split(".");
      keyParts.forEach((keyPart, i) => {
        if (currNode[keyPart] === undefined) {
          currNode[keyPart] = {};
        }

        if (i === keyParts.length - 1) {
          currNode[keyPart] = value;
        }

        currNode = currNode[keyPart];
      });
    } else if (key.match(/page|limit/) && typeof value === "string") {
      queryObj[key] = parseInt(value);
    } else {
      queryObj[key] = parseQueryValue(value as string);
    }
  }

  return queryObj;
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

export async function get(dbPath: string, options: GetOptions = {}) {
  let limit = parseInt(options?.limit as string) ?? 20;
  if (isNaN(limit)) limit = 20;

  const page = parseInt(options?.page as string) || 1;
  const sort = options?.sort;
  const filters = options?.filters || {};
  const collectionRef = client.collection(dbPath);
  let queryChain: FirebaseFirestore.Query = collectionRef;
  const normalizedDocs: Record<string, any>[] = [];

  if (limit) {
    queryChain = queryChain.limit(limit);
  }

  if (page) {
    const offset = (page - 1) * limit;
    queryChain = queryChain.offset(offset);
  }

  // NOTE: Firestore only supports one field filter at a time w/o index.
  const rawFilterItems = Object.entries(filters);
  const filterItems = [];
  if (rawFilterItems.length > 0) {
    for (const [field, value] of rawFilterItems) {
      if (value.includes(" AND ")) {
        const values = value.split(" AND ");
        for (const val of values) {
          // > or < operators
          if (val.match(/^[><=]+ /)) {
            const [operator, finalVal] = val.split(" ");
            filterItems.push({
              field,
              operator: operator,
              value: parseQueryValue(finalVal),
            });
          } else {
            filterItems.push({
              field,
              operator: "==",
              value: parseQueryString(val),
            });
          }
        }
      } else {
        filterItems.push({
          field,
          operator: "==",
          value: parseQueryValue(value as string),
        });
      }
    }
  }
  for (const filterItem of filterItems) {
    queryChain = queryChain.where(
      filterItem.field,
      filterItem.operator,
      filterItem.value
    );
  }

  if (sort) {
    const [field, direction] = sort.split(" ");
    queryChain = queryChain.orderBy(
      field,
      (direction || "asc") as OrderByDirection
    );
  }

  const docs = await queryChain.get();
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
