import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  DocumentData,
  DocumentSnapshot,
  OrderByDirection,
  Query,
  QueryDocumentSnapshot,
  Timestamp,
} from "firebase-admin/firestore";
import queryString from "query-string";

type NormalizeDocOptionsParams = {
  hidePrivate?: boolean;
  schema?: Record<string, any>;
};

type QueryOptions = {
  filters?: Record<string, any>;
  lastId?: string;
  sort?: string;
  page?: number;
  limit?: number;
  hidePrivate?: boolean;
};

const defaultGetOptions: QueryOptions = {
  filters: {},
  limit: 20,
  page: 1,
  hidePrivate: true,
};

export function init() {
  return getFirestore(app());
}

export function app() {
  const apps = getApps();

  if (apps.length > 0) {
    return apps[0];
  }

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
    databaseURL: process.env.FIREBASE_DB_URL,
  });
}

export async function count(
  dbPath: string,
  queryOptions: QueryOptions = { filters: {} }
) {
  const { filters } = queryOptions;
  const db = init();
  let query: Query<DocumentData> = db.collection(dbPath);

  for (const field of Object.keys(filters || {})) {
    const value = (filters ?? {})[field];
    if (value) {
      query = query.where(field, "==", value);
    }
  }

  const snapshot = await query.count().get();
  const results = snapshot.data().count;

  return results;
}

export async function get(
  dbPath: string,
  queryOptions: QueryOptions = defaultGetOptions
) {
  const db = init();
  const collection = db.collection(dbPath);
  const finalQueryOptions = { ...defaultGetOptions, ...queryOptions };
  const { sort, lastId, limit, hidePrivate } = finalQueryOptions;
  const page = finalQueryOptions.page || 1;
  const filters = finalQueryOptions.filters || {};
  let query: Query<DocumentData> = collection;
  let results: Record<string, any>[] = [];

  if (typeof limit === "number") {
    query = query.limit(limit);
  }

  if (sort) {
    const [field, direction] = sort.split(" ");
    query = query.orderBy(field, direction as OrderByDirection);
  }

  if (page > 1 && lastId) {
    const lastDoc = await collection.doc(lastId).get();
    if (lastDoc.exists) {
      query = query.startAfter(lastDoc);
    }
  }

  for (const field of Object.keys(filters || {})) {
    const value = (filters ?? {})[field];
    if (value) {
      query = query.where(field, "==", value);
    }
  }

  const snapshot = (await query.get()) || [];
  for (const doc of snapshot.docs) {
    const normalizedDoc = normalizeDoc(doc, { hidePrivate });
    results.push(normalizedDoc);
  }

  return results;
}

export async function getById(dbPath: string, id: string) {
  const db = init();
  const collection = db.collection(dbPath);
  let doc;

  if (id.startsWith("k_")) {
    const query = collection.where("key", "==", id.replace("k_", ""));
    const snapshot = await query.get();
    if (snapshot.empty || !snapshot.docs?.[0])
      throw new Error("Resource not found");
    doc = snapshot.docs?.[0];
  } else {
    const docRef = collection.doc(id);
    doc = await docRef.get();
    if (!doc.exists) throw new Error("Resource not found");
  }

  return normalizeDoc(doc, { hidePrivate: true });
}

export function normalizeDoc(
  doc: DocumentSnapshot | QueryDocumentSnapshot,
  options: NormalizeDocOptionsParams = { hidePrivate: true, schema: {} }
) {
  const docData = doc.data() || {};
  const currentDoc: Record<string, any> = { id: doc.id };

  for (const field of Object.keys(docData)) {
    let value = docData[field];
    const show =
      (options.hidePrivate === false && field.startsWith("_")) ||
      !field.startsWith("_");

    if (value instanceof Timestamp) value = value.toDate();

    if (show) {
      currentDoc[field] = value;
    }
  }

  return currentDoc;
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
    } else if (value === "false") {
      queryObj[key] = false;
    } else if (value === "true") {
      queryObj[key] = true;
    } else {
      queryObj[key] = value;
    }
  }

  return queryObj;
}

export async function patch(
  dbPath: string,
  id: string,
  data: Record<string, any>
) {
  const db = init();
  const collection = db.collection(dbPath);
  const docRef = collection.doc(id);
  const doc = await docRef.get();

  if (!doc.exists) throw new Error("Resource not found");

  let sanitizedData = sanitize(data);
  sanitizedData.updated = Timestamp.now();

  await docRef.update(sanitizedData);
  const updatedDoc = await docRef.get();

  return normalizeDoc(updatedDoc);
}

export async function post(dbPath: string, data: Record<string, any>) {
  const db = init();
  const dbCollection = db.collection(dbPath);
  const _data = {
    ...sanitize(data),
    created: Timestamp.now(),
    updated: Timestamp.now(),
  } as Record<string, any>;

  const newDoc = await dbCollection.add(_data);
  const confirmDoc = await dbCollection.doc(newDoc.id).get();

  return normalizeDoc(confirmDoc);
}

export async function remove(dbPath: string, id: string) {
  const db = init();
  const dbCollection = db.collection(dbPath);
  const docRef = dbCollection.doc(id);
  const doc = await docRef.get();

  if (!doc.exists) throw new Error("Resource not found");

  await docRef.delete();

  return true;
}

export function sanitize(record: Record<string, any>) {
  const sanitizedRecord: Record<string, any> = {};

  for (const key of Object.keys(record)) {
    const value = record[key];

    // Users are not allowed to change system fields
    if (!["id", "created", "updated"].includes(key)) {
      sanitizedRecord[key] = value;
    }
  }

  return sanitizedRecord;
}
