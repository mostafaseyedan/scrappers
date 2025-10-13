import { z } from "zod";
import { cnStatuses } from "./config";
import queryString from "query-string";

/*
type CountParams = {
  collection: string;
  filters?: Record<string, any>;
}; */

type GetParams = {
  collection: string;
  page?: string;
  sort?: string;
  limit?: number;
  filters?: Record<string, any>;
  token?: string;
  baseUrl?: string;
};

type GetByIdParams = {
  collection: string;
  id: string;
  token?: string;
  baseUrl?: string;
};

type GetByKeyParams = {
  collection: string;
  key: string;
  token?: string;
  baseUrl?: string;
};

type PatchParams = {
  collection: string;
  id: string;
  data: Record<string, any>;
  token?: string;
  baseUrl?: string;
};

type PatchByKeyParams = {
  collection: string;
  key: string;
  data: Record<string, any>;
  token?: string;
  baseUrl?: string;
};

type PostParams = {
  collection: string;
  data: Record<string, any>;
  schema?: z.ZodTypeAny;
  baseUrl?: string;
  token?: string;
};

type PutParams = {
  collection: string;
  id: string;
  data: Record<string, any>;
  token?: string;
  baseUrl?: string;
};

type RemoveParams = {
  collection: string;
  id: string;
  token?: string;
  baseUrl?: string;
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
  token?: string;
  baseUrl?: string;
};

const defaultCalls = {
  count: async ({
    collection,
    filters,
    token,
    baseUrl,
  }: Partial<GetParams>) => {
    const flattenedFilters: Record<string, any> = {};
    for (const [key, value] of Object.entries(filters || {})) {
      flattenedFilters[`filters.${key}`] = value;
    }

    const urlQueryString = queryString.stringify({
      ...flattenedFilters,
    });

    const resp = await fetch(
      `${baseUrl || ""}/api/${collection}/counts?${urlQueryString}`,
      {
        method: "GET",
        ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      }
    );
    const json = await resp.json();

    if (json.error) {
      throw new Error(
        `Failed to fetch count. ${json.error} (defaultCalls.count/${collection})`
      );
    }

    return json.count || 0;
  },
  get: async ({
    collection,
    page,
    limit,
    sort,
    filters,
    token,
    baseUrl,
  }: GetParams) => {
    const flattenedFilters: Record<string, any> = {};
    for (const [key, value] of Object.entries(filters || {})) {
      flattenedFilters[`filters.${key}`] = value;
    }

    const urlQueryString = queryString.stringify({
      limit,
      sort,
      page,
      ...flattenedFilters,
    });

    const resp = await fetch(
      `${baseUrl || ""}/api/${collection}?${urlQueryString}`,
      {
        ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      }
    );
    const json = await resp.json();

    if (json.error) {
      throw new Error(
        `Failed to fetch data. ${json.error} (defaultCalls.get/${collection})`
      );
    }

    return json;
  },
  getById: async ({ collection, id, token, baseUrl }: GetByIdParams) => {
    const resp = await fetch(`${baseUrl || ""}/api/${collection}/${id}`, {
      method: "GET",
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
    });
    const json = await resp.json();

    if (json.error) {
      throw new Error(
        `Failed to fetch data by ID: ${id}. ${json.error} (defaultCalls.getById/${collection})`
      );
    }

    return json;
  },
  getByKey: async ({ collection, key, token, baseUrl }: GetByKeyParams) => {
    const urlQueryString = queryString.stringify({
      "filters.key": key,
      sort: "",
    });

    const resp = await fetch(
      `${baseUrl || ""}/api/${collection}?${urlQueryString}`,
      {
        method: "GET",
        ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      }
    );
    const json = await resp.json();

    if (json.error) {
      throw new Error(
        `Failed to fetch data by key: ${key}. ${json.error} (defaultCalls.getByKey/${collection})`
      );
      return null;
    }

    if (!json.results || !json.results.length) {
      throw new Error(
        `Failed to fetch data by key: ${key}. Record not found. (defaultCalls.getByKey/${collection})`
      );
      return null;
    }

    return json.results[0];
  },
  post: async ({ collection, data, schema, token, baseUrl }: PostParams) => {
    if (schema?.parse) {
      data = schema.parse(data) as Record<string, any>;
    }

    const resp = await fetch(`${baseUrl || ""}/api/${collection}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    });
    const json = await resp.json();

    if (json.error) {
      throw new Error(
        `Failed to create data. ${json.error} (defaultCalls.post/${collection})`
      );
    }

    return json;
  },
  put: async ({ collection, id, data, token, baseUrl }: PutParams) => {
    const resp = await fetch(`${baseUrl || ""}/api/${collection}/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    });
    const json = await resp.json();

    if (json.error) {
      throw new Error(
        `Failed to update data with ID: ${id}. ${json.error} (defaultCalls.patch/${collection})`
      );
    }

    return json;
  },
  patch: async ({ collection, id, data, token, baseUrl }: PatchParams) => {
    const resp = await fetch(`${baseUrl || ""}/api/${collection}/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    });
    const json = await resp.json();

    if (json.error) {
      throw new Error(
        `Failed to update data with ID: ${id}. ${json.error} (defaultCalls.patch/${collection})`
      );
    }

    return json;
  },
  patchByKey: async ({
    collection,
    key,
    data,
    token,
    baseUrl,
  }: PatchByKeyParams) => {
    const record = await defaultCalls.getByKey({
      collection,
      key,
      token,
      baseUrl,
    });

    if (!record) {
      throw new Error(
        `Document not found with key: ${key}. (defaultCalls.patchByKey/${collection})`
      );
    }

    return await defaultCalls.patch({
      collection,
      id: record.id,
      data,
      token,
      baseUrl,
    });
  },
  remove: async ({ collection, id, token, baseUrl }: RemoveParams) => {
    const resp = await fetch(`${baseUrl || ""}/api/${collection}/${id}`, {
      method: "DELETE",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const json = await resp.json();

    if (json.error) {
      throw new Error(
        `Failed to delete data with ID: ${id}. ${json.error} (defaultCalls.remove/${collection})`
      );
    }

    return id;
  },
  search: async () => {},
  upsertByKey: async ({
    collection,
    key,
    data,
    token,
    baseUrl,
  }: UpsertByKeyParams) => {
    const existingRecord = await defaultCalls
      .getByKey({
        collection,
        key,
        token,
        baseUrl,
      })
      .catch((err: any) => console.error(err?.message));

    data.key = key; // Ensure the key is set in the data

    if (existingRecord) {
      return await defaultCalls.patch({
        collection,
        id: existingRecord.id,
        data,
        token,
        baseUrl,
      });
    }

    return await defaultCalls.post({
      collection,
      data,
      token,
      baseUrl,
    });
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
    data: z.any().default({}),
  }),
  get: async ({ collection = "scriptLogs", ...options }: GetParams) =>
    await defaultCalls.get({ collection, ...options }),
  post: async ({ collection = "scriptLogs", data, ...options }: PostParams) =>
    await defaultCalls.post({
      collection,
      data,
      ...options,
    }),
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
      publishDate: z.string().datetime(),
      questionsDueByDate: z.coerce.string(),
      rfpType: z.coerce.string(),
      site: z.string(),
      siteData: z.any().default({}),
      siteId: z.string(),
      siteUrl: z.string().url(),
      sourceKey: z.string(),
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
      issuer: z.string().optional(),
      keywords: z.array(z.string()).default([]),
      location: z.string().default(""),
      logs: z.array(z.any()).default([]).describe("[submodel]"),
      mondayUrl: z.string().optional(),
      publishDate: z.string().nullable().default(null),
      questionsDueByDate: z.string().nullable().default(null),
      rfpType: z.string().optional(),
      sharepointUrl: z.string().default(""),
      site: z.string().default("unknown"),
      siteData: z.any().default({}),
      siteId: z.string().optional(),
      siteUrl: z.string().default(""),
      sourceKey: z.string().default(""),
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
      issuer: z.string().optional(),
      keywords: z.string().optional(),
      location: z.string().optional(),
      publishDate: z.string().optional(),
      title: z.string().min(1, "Title is required"),
    }),
  },
  count: async ({ ...options }: Partial<GetParams> = {}) =>
    await defaultCalls.count({
      ...options,
      collection: "solicitations",
    }),
  get: async ({ ...options }: Partial<GetParams> = {}) =>
    await defaultCalls.get({ collection: "solicitations", ...options }),
  getById: async ({ id, ...options }: GetByIdParams) =>
    await defaultCalls.getById({ ...options, collection: "solicitations", id }),
  patch: async ({ id, data, ...options }: PatchParams) =>
    await defaultCalls.patch({
      ...options,
      collection: "solicitations",
      id,
      data,
    }),
  post: async ({ data, ...options }: PostParams) =>
    await defaultCalls.post({
      ...options,
      collection: "solicitations",
      data,
    }),
  put: async ({ id, data, ...options }: PutParams) =>
    await defaultCalls.put({
      ...options,
      collection: "solicitations",
      id,
      data,
    }),
  remove: async ({ id, ...options }: RemoveParams) =>
    await defaultCalls.remove({ ...options, collection: "solicitations", id }),
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
    parentCollection: z.string().default("solicitations"),
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
      body: JSON.stringify({ ...data, parentCollection: "solicitations" }),
    });
    const json = await resp.json();
    if (json.error) throw new Error("Failed to create comment");
    return json;
  },
};

const solicitation_log: any = {
  schema: {
    db: z.object({
      message: z.string(),
      actionUserId: z.string(),
      actionKey: z
        .enum(["", "create", "comment", "update", "delete", "view"])
        .default(""),
      actionData: z.object({}).default({}),
      parentCollection: z.string().default("solicitations"),
    }),
  },
  get: async ({
    solId,
    ...options
  }: {
    solId: string;
    filters?: Record<string, any>;
    limit?: number;
    sort?: string;
  }) =>
    await defaultCalls.get({
      collection: `solicitations/${solId}/logs`,
      ...options,
    }),
  getAll: async ({ ...options }) =>
    await defaultCalls.get({ collection: "solicitations/logs", ...options }),
  post: async ({
    solId,
    data,
    ...options
  }: {
    solId: string;
    data: Record<string, any>;
  }) =>
    await defaultCalls.post({
      ...options,
      data: { ...data, parentCollection: "solicitations" },
      collection: `solicitations/${solId}/logs`,
    }),
};

const source: any = {
  schema: {
    db: z.object({
      name: z.string().min(1),
      key: z.string().min(1),
      type: z
        .enum([
          "",
          "aggregator",
          "city",
          "county",
          "federal",
          "other",
          "school",
          "state",
          "water",
        ])
        .default(""),
      cnNotes: z.string().optional(),
      description: z.string().optional(),
      url: z.string().url().or(z.literal("")).default(""),
    }),
  },
  count: async ({ ...options }: Partial<GetParams> = {}) =>
    await defaultCalls.count({
      ...options,
      collection: "sources",
    }),
  get: async (options: GetParams) =>
    await defaultCalls.get({ ...options, collection: "sources" }),
  getById: async ({ id, ...options }: GetByIdParams) =>
    await defaultCalls.getById({ ...options, collection: "sources", id }),
  getByKey: async ({ key, ...options }: GetByKeyParams) =>
    await defaultCalls.getByKey({ ...options, collection: "sources", key }),
  patch: async ({ id, data, ...options }: PatchParams) =>
    await defaultCalls.patch({
      ...options,
      collection: "sources",
      id,
      data,
    }),
  post: async ({ data, ...options }: PostParams) =>
    await defaultCalls.post({
      ...options,
      collection: "sources",
      data,
    }),
  remove: async ({ id, ...options }: RemoveParams) =>
    await defaultCalls.remove({ ...options, collection: "sources", id }),
};

const stat: any = {
  schema: {
    db: z.object({
      key: z.string(),
      parentKey: z.string(),
      value: z.number(),
      periodType: z.enum(["", "day", "week", "month", "year"]).default(""),
      description: z.string().default(""),
      startDate: z.string(),
      endDate: z.string(),
    }),
  },
  get: async ({ collection = "stats", ...options }: GetParams) =>
    await defaultCalls.get({ collection, ...options }),
  getByKey: async ({ collection = "stats", key }: GetByKeyParams) =>
    await defaultCalls.getByKey({
      collection,
      key,
    }),
  patchByKey: async ({
    collection = "stats",
    key,
    data,
    ...options
  }: PatchByKeyParams) =>
    await defaultCalls.patchByKey({
      collection,
      key,
      data,
      ...options,
    }),
  post: async ({ collection = "stats", data, ...options }: PostParams) =>
    await defaultCalls.post({
      collection,
      data,
      ...options,
    }),
  upsertByKey: async ({
    collection = "stats",
    key,
    data,
    ...options
  }: UpsertByKeyParams) =>
    await defaultCalls.upsertByKey({
      collection,
      key,
      data,
      ...options,
    }),
};

export {
  solicitation,
  solicitation_comment,
  solicitation_log,
  source,
  scriptLog,
  stat,
};
