import { z } from "zod";
import { db } from "@/lib/firebaseClient";
import {
  collection as fCollection,
  addDoc,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit as fLimit,
  orderBy,
  updateDoc,
  query,
  where,
  startAfter as fStartAfter,
} from "firebase/firestore";
import { cnStatuses } from "./config";
import queryString from "query-string";
import { normalizeDoc } from "@/lib/firebaseClient";
import { parseQueryValue } from "@/lib/firebaseClient";

type CountParams = {
  collection: string;
  filters?: Record<string, any>;
};

type GetParams = {
  collection: string;
  startAfter?: string;
  sort?: string;
  limit?: number;
  filters?: Record<string, any>;
};

type GetByIdParams = {
  collection: string;
  id: string;
};

type GetByKeyParams = {
  collection: string;
  key: string;
};

type PatchParams = {
  collection: string;
  id: string;
  data: Record<string, any>;
};

type PatchByKeyParams = {
  collection: string;
  key: string;
  data: Record<string, any>;
};

type PostParams = {
  collection: string;
  data: Record<string, any>;
  schema?: z.ZodTypeAny;
};

type RemoveParams = {
  collection: string;
  id: string;
};

type SolSearchParams = {
  baseUrl?: string;
  q?: string;
  limit?: number;
  page?: number;
  sort?: string;
  filter?: Record<string, any>;
  token?: string;
};

type UpsertByKeyParams = {
  collection: string;
  key: string;
  data: Record<string, any>;
};

const dbSol: any = {
  schema: z.object({
    categories: z.array(z.string()).default([]),
    closingDate: z.date().nullable(),
    cnData: z.object({}).default({}),
    cnLiked: z.boolean().default(false),
    cnModified: z.boolean().default(false),
    cnStatus: z
      .enum(Object.keys(cnStatuses) as [string, ...string[]])
      .default("new"),
    comments: z.array(z.object({})).default([]).describe("[submodel]"),
    commentsCount: z.number().default(0),
    contactEmail: z.string().optional(),
    contactName: z.string().optional(),
    contactNote: z.string().optional(),
    contactPhone: z.string().optional(),
    created: z.date(),
    description: z.string(),
    documents: z.array(z.string().url()).default([]),
    externalLinks: z.array(z.string()).default([]),
    issuer: z.string(),
    keywords: z.array(z.string()).default([]),
    location: z.string(),
    logs: z.array(z.any()).default([]).describe("[submodel]"),
    publicationDate: z.date().optional(),
    questionsDueByDate: z.date().optional(),
    rfpType: z.string().optional(),
    site: z.string(),
    siteData: z.any().default({}),
    siteId: z.string(),
    siteUrl: z.string().optional(),
    title: z.string(),
    updated: z.date(),
    url: z.string().optional(),
  }),
};

const defaultCalls = {
  count: async ({ collection, filters }: CountParams) => {
    const colRef = fCollection(db, collection);
    let queryRef: any = colRef;

    // TODO: fix this
    Object.entries(filters || {}).forEach(([key, value]) => {
      queryRef = query(queryRef, where(key, "==", value));
    });

    const snap = await getCountFromServer(queryRef);
    return snap.data().count;
  },
  get: async ({ collection, startAfter, limit, sort, filters }: GetParams) => {
    const finalLimit = limit || 20;
    const finalSort = sort || "created desc";
    const finalFilters = filters || {};
    let results: Record<string, any>[] = [];
    const colRef = fCollection(db, collection);
    let q = query(colRef);

    if (finalLimit) {
      q = query(q, fLimit(finalLimit));
    }

    if (finalSort) {
      const sortParts = finalSort.split(" ");
      const order = sortParts[1] === "desc" ? "desc" : "asc";
      q = query(q, orderBy(sortParts[0], order));
    }

    const rawFilterItems = Object.entries(finalFilters);
    const filterItems = [];
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
              value: parseQueryValue(val),
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

    for (const item of filterItems) {
      const { field, operator, value } = item;
      q = query(q, where(field, operator, value));
    }

    if (startAfter) {
      const startAfterDoc = doc(db, "scriptLogs", startAfter);
      q = query(q, fStartAfter(startAfterDoc));
    }

    const docs = await getDocs(q);
    docs.forEach((doc) => {
      results.push({ id: doc.id, ...normalizeDoc(doc) });
    });

    return results;
  },
  getById: async ({ collection, id }: GetByIdParams) => {
    const docRef = doc(db, collection, id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists())
      throw new Error("defaultCalls.getById - document not found");
    return { id: docSnap.id, ...normalizeDoc(docSnap) };
  },
  getByKey: async ({ collection, key }: GetByKeyParams) => {
    const colRef = fCollection(db, collection);
    const q = query(colRef, where("key", "==", key));
    const snapshot = await getDocs(q);
    if (snapshot.empty)
      throw new Error("defaultCalls.getByKey - document not found");
    return { id: snapshot.docs[0].id, ...normalizeDoc(snapshot.docs[0]) };
  },
  post: async ({ collection, data, schema }: PostParams) => {
    const colRef = fCollection(db, collection);

    if (schema?.parse) {
      data = schema.parse(data);
    }

    data.created = new Date();
    data.updated = new Date();

    const docRef = await addDoc(colRef, data);
    const docSnap = await getDoc(docRef);

    return { id: docSnap.id, ...normalizeDoc(docSnap) };
  },
  put: async () => {},
  patch: async ({ collection, id, data }: PatchParams) => {
    const record = await defaultCalls.getById({ collection, id });
    if (!record) throw new Error("defaultCalls.patch - document not found");
    data.updated = new Date();
    await updateDoc(doc(db, collection, id), data);
    return await defaultCalls.getById({ collection, id });
  },
  patchByKey: async ({ collection, key, data }: PatchByKeyParams) => {
    const record = await defaultCalls.getByKey({ collection, key });
    return await defaultCalls.patch({ collection, id: record.id, data });
  },
  remove: async ({ collection, id }: RemoveParams) => {
    const record = await defaultCalls.getById({ collection, id });
    if (!record) throw new Error("defaultCalls.remove - document not found");
    await deleteDoc(doc(db, collection, id));
    return { id };
  },
  search: async () => {},
  upsertByKey: async ({ collection, key, data }: UpsertByKeyParams) => {
    const record = await defaultCalls
      .getByKey({ collection, key })
      .catch((error) => {
        // Keep not found error silent
        if (!error.message.match(/not found/)) throw error;
      });
    const id = record?.id;
    delete data.id;
    return id
      ? await defaultCalls.patch({ collection, id, data })
      : await defaultCalls.post({ collection, data });
  },
};

const scriptLog: any = {
  schema: z.object({
    message: z.string(),
    scriptName: z.string(),
    lastItemId: z.string().optional(),
    dupCount: z.number().default(0),
    successCount: z.number().default(0),
    failCount: z.number().default(0),
    junkCount: z.number().default(0),
    timeStr: z.string().default("00:00:00"), // hh:mm:ss
  }),
  get: (options: Partial<GetParams>) =>
    defaultCalls.get({ collection: "scriptLogs", ...options }),
  post: async (
    baseUrl: string,
    data: z.infer<typeof scriptLog.schema>,
    token: string
  ) => {
    const resp = await fetch(`${baseUrl}/api/scriptLogs`, {
      method: "POST",
      headers: {
        Cookie: `AuthToken=${token}`,
      },
      body: JSON.stringify(data),
    });
    const json = await resp.json();
    if (json.error) throw new Error("Failed to create scraping log");
    return json;
  },
};

const solicitation: any = {
  schema: {
    old: z.object({
      categories: z.array(z.string()).default([]),
      closingDate: z.string().datetime(),
      cnData: z.object({}).default({}),
      cnLiked: z.boolean().default(false),
      cnModified: z.boolean().default(false),
      cnStatus: z
        .enum(Object.keys(cnStatuses) as [string, ...string[]])
        .default("new"),
      cnType: z.string().default(""),
      comments: z.array(z.object({})).default([]).describe("[submodel]"),
      commentsCount: z.number().default(0),
      contactEmail: z.string(),
      contactName: z.string(),
      contactNote: z.string(),
      contactPhone: z.string(),
      created: z.string().datetime(), // system
      description: z.string(),
      documents: z.array(z.string().url()).default([]), // WARNING: do not change this structure
      externalLinks: z.array(z.string().url()).default([]),
      issuer: z.string(),
      keywords: z.array(z.string()).default([]),
      location: z.string(),
      logs: z.array(z.any()).default([]).describe("[submodel]"),
      publicationDate: z.string().datetime(),
      questionsDueByDate: z.coerce.string(),
      rfpType: z.coerce.string(),
      site: z.string(),
      siteData: z.any().default({}),
      siteId: z.string(),
      siteUrl: z.string().url(),
      title: z.string(),
      updated: z.string().datetime(), // system
      url: z.string().url(),
      viewedBy: z.array(z.string()).default([]),
    }),
    postApi: z.object({
      authorId: z.string(),
      categories: z.array(z.string()).default([]),
      closingDate: z.string().nullable().default(null),
      cnData: z.object({}).default({}),
      cnLiked: z.boolean().default(false),
      cnModified: z.boolean().default(false),
      cnNotes: z.string().optional(),
      cnStatus: z
        .enum(Object.keys(cnStatuses) as [string, ...string[]])
        .default("new"),
      comments: z.array(z.object({})).default([]).describe("[submodel]"),
      commentsCount: z.number().default(0),
      contactNote: z.string().optional(),
      created: z.string().datetime(),
      description: z.string().optional(),
      documents: z.array(z.string().url()).default([]),
      externalLinks: z.array(z.string()).default([]),
      issuer: z.string().min(1, "Issuer is required"),
      keywords: z.array(z.string()).default([]),
      location: z.string().min(1, "Location is required"),
      logs: z.array(z.any()).default([]).describe("[submodel]"),
      publishDate: z.string().nullable().default(null),
      questionsDueByDate: z.string().nullable().default(null),
      rfpType: z.string().optional(),
      site: z.string().default("unknown"),
      siteData: z.any().default({}),
      siteId: z.string().optional(),
      siteUrl: z.string().default(""),
      title: z.string().min(1, "Title is required"),
      updated: z.string().datetime(),
      url: z.string().default(""),
      viewedBy: z.array(z.string()).default([]),
    }),
    postForm: z.object({
      categories: z.string().optional(),
      closingDate: z.string().optional(),
      cnNotes: z.string().optional(),
      contactNote: z.string().optional(),
      description: z.string().optional(),
      externalLink: z.string().url().optional(),
      issuer: z.string().min(1, "Issuer is required"),
      keywords: z.string().optional(),
      location: z.string().min(1, "Location is required"),
      publicationDate: z.string().optional(),
      title: z.string().min(1, "Title is required"),
    }),
  },
  count: async (filter: Record<string, any> = {}) => {
    const colRef = collection(db, "solicitations");
    let queryRef: any = colRef;

    Object.entries(filter).forEach(([key, value]) => {
      queryRef = query(queryRef, where(key, "==", value));
    });

    const snap = await getCountFromServer(queryRef);
    return snap.data().count;
  },
  get: () => {},
  getById: async (id: string) => {
    const docRef = doc(db, "solicitations", id);
    const resp = await getDoc(docRef);
    return { id, ...resp.data() };
  },
  patch: async ({
    baseUrl = "",
    id,
    data,
    token,
  }: {
    baseUrl?: string;
    id: string;
    data: z.infer<typeof solicitation.schema>;
    token?: string;
  }) => {
    const resp = await fetch(`${baseUrl}/api/solicitations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      ...(token && {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }),
    });
    const json = await resp.json();

    if (json.error) {
      throw new Error("Failed to update solicitation");
    }

    return json;
  },
  post: async (
    baseUrl: string,
    data: z.infer<typeof solicitation.schema>,
    token?: string
  ) => {
    const resp = await fetch(`${baseUrl}/api/solicitations`, {
      method: "POST",
      body: JSON.stringify(data),
      ...(token && {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }),
    });
    const json = await resp.json();
    if (json.error) throw new Error("Failed to create solicitation");
    return json;
  },
  put: async (id: string, data: z.infer<typeof solicitation.schema>) => {
    const resp = await fetch(`/api/solicitations/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    const json = await resp.json();
    if (json.error) throw new Error("Failed to update solicitation");
    return json;
  },
  remove: async (id: string, baseUrl: string = "", token: string) => {
    const resp = await fetch(`${baseUrl}/api/solicitations/${id}`, {
      method: "DELETE",
      headers: {
        Cookie: `AuthToken=${token}`,
      },
      credentials: "include",
    });
    const json = await resp.json();
    if (json.error) throw new Error("Failed to delete solicitation");
    return id;
  },
  search: async (params: SolSearchParams = {}) => {
    const baseUrl = params.baseUrl || "";

    const flattenedFilter: Record<string, any> = {};
    for (const [key, value] of Object.entries(params.filter || {})) {
      flattenedFilter[`filter.${key}`] = value;
    }

    delete params.filter;
    const urlQueryString = queryString.stringify({
      ...params,
      ...flattenedFilter,
    });

    const resp = await fetch(
      `${baseUrl}/api/solicitations/search?${urlQueryString}`,
      {
        headers: {
          Cookie: `AuthToken=${params.token}`,
        },
        credentials: "include",
      }
    );
    const json = await resp.json();

    return (
      json.hits?.hits?.map((hit: Record<string, any>) => ({
        id: hit._id,
        ...hit._source,
      })) || []
    );
  },
};

const solicitation_comment: any = {
  schema: z.object({
    body: z.string(),
    attachments: z.array(z.string().url()).default([]),
    authorId: z.string(),
  }),
  get: async (solId: string) => {
    const resp = await fetch(`/api/solicitations/${solId}/comments`);
    const json = await resp.json();
    if (json.error) throw new Error("Failed to fetch comments");
    return json;
  },
  post: async (
    solId: string,
    data: z.infer<typeof solicitation_comment.schema>
  ) => {
    const resp = await fetch(`/api/solicitations/${solId}/comments`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    const json = await resp.json();
    if (json.error) throw new Error("Failed to create comment");
    return json;
  },
};

const solicitation_log: any = {
  schema: z.object({
    message: z.string(),
    actionKey: z.string(),
    userId: z.string(),
  }),
};

const stat: any = {
  schema: {
    db: z.object({
      key: z.string(),
      value: z.number(),
      periodType: z.enum(["", "day", "week", "month", "year"]).default(""),
      description: z.string().default(""),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }),
  },
  getByKey: ({ collection = "stats", key }: GetByKeyParams) =>
    defaultCalls.getByKey({
      collection,
      key,
    }),
  patchByKey: async ({ collection = "stats", key, data }: PatchByKeyParams) =>
    await defaultCalls.patchByKey({
      collection,
      key,
      data,
    }),
  post: async ({ collection = "stats", data }: PostParams) =>
    await defaultCalls.post({
      collection,
      data,
    }),
  upsertByKey: async ({ collection = "stats", key, data }: UpsertByKeyParams) =>
    await defaultCalls.upsertByKey({
      collection,
      key,
      data,
    }),
};

export {
  dbSol,
  solicitation,
  solicitation_comment,
  solicitation_log,
  scriptLog,
  stat,
};
