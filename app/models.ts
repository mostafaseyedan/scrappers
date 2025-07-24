import { z } from "zod";
import { db } from "@/lib/firebaseClient";
import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  query,
  where,
} from "firebase/firestore";
import { cnStatuses } from "./config";
import queryString from "query-string";

type SolSearchParams = {
  baseUrl?: string;
  q?: string;
  limit?: number;
  page?: number;
  sort?: string;
  filter?: Record<string, any>;
  token?: string;
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

const scraping_log: any = {
  schema: z.object({
    message: z.string(),
    scriptName: z.string(),
    lastItemId: z.string().optional(),
    successCount: z.number().default(0),
    failCount: z.number().default(0),
    timeStr: z.string().datetime(), // hh::mm:ss
  }),
};

const solicitation: any = {
  schema: z.object({
    categories: z.array(z.string()).default([]),
    closingDate: z.string().datetime(),
    cnData: z.object({}).default({}),
    cnLiked: z.boolean().default(false),
    cnModified: z.boolean().default(false),
    cnStatus: z
      .enum(Object.keys(cnStatuses) as [string, ...string[]])
      .default("new"),
    comments: z.array(z.object({})).default([]).describe("[submodel]"),
    commentsCount: z.number().default(0),
    contactEmail: z.string(),
    contactName: z.string(),
    contactNote: z.string(),
    contactPhone: z.string(),
    created: z.string().datetime(),
    description: z.string(),
    documents: z.array(z.string().url()).default([]),
    externalLinks: z.array(z.string().url()).default([]),
    issuingOrganization: z.string(),
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
    updated: z.string().datetime(),
    url: z.string().url(),
  }),
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
  patch: async (id: string, data: z.infer<typeof solicitation.schema>) => {
    const resp = await fetch(`/api/solicitations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    const json = await resp.json();

    if (json.error) {
      throw new Error("Failed to update solicitation");
    }

    return json;
  },
  post: (data: z.infer<typeof solicitation.schema>) => {
    return data;
  },
  put: async (id: string, data: z.infer<typeof solicitation.schema>) => {
    const resp = await fetch(`/api/solicitations/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    const json = await resp.json();

    if (json.error) {
      throw new Error("Failed to update solicitation");
    }

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

    if (json.error) {
      throw new Error("Failed to delete solicitation");
    }

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

export {
  dbSol,
  solicitation,
  solicitation_comment,
  solicitation_log,
  scraping_log,
};
