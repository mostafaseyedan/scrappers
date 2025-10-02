import { z } from "zod";
import queryString from "query-string";
import useSWR from "swr";
import urlJoin from "url-join";

export type Model = {
  schema: { db: z.ZodSchema };
};

type ApiOptions = {
  url: string;
  token?: string;
};
type ApiOptionsWithData = ApiOptions & { data: Record<string, any> };
type ApiOptionsWithId = ApiOptions & { id: string };
type ApiOptionsWithIdAndData = ApiOptionsWithData & { id: string };

type QueryOptions = {
  page?: number;
  limit?: number;
  sort?: string;
  filters?: Record<string, any>;
};

const fetcher = (...args: Parameters<typeof fetch>) =>
  fetch(...args).then((res) => res.json());

const defaultCalls = {
  get: async ({
    url,
    queryOptions,
    token,
  }: ApiOptions & { queryOptions?: QueryOptions }) => {
    const { page, limit, sort, filters } = queryOptions || {};
    let sanitizedQ: Record<string, any> = {};

    if (page && !isNaN(Number(page))) sanitizedQ.page = Number(page);
    if (limit && !isNaN(Number(limit))) sanitizedQ.limit = Number(limit);
    if (sort) sanitizedQ.sort = sort;

    // Flatten filters
    const flattenedFilters: Record<string, any> = {};
    if (Object.keys(filters || {}).length) {
      for (const key in filters) {
        const value = filters[key];
        flattenedFilters[`filters.${key}`] = value;
      }
      sanitizedQ = { ...sanitizedQ, ...flattenedFilters };
    }

    const qs = queryOptions
      ? `?${queryString.stringify(sanitizedQ, { arrayFormat: "bracket" })}`
      : "";
    const resp = await fetch(urlJoin(url, qs), {
      method: "GET",
      ...(token && { headers: { Authorization: `Bearer ${token}` } }),
    });
    const respData = await resp.json();

    if (respData.error) throw new Error(respData.error);

    return respData;
  },
  getById: async ({ url, id, token }: ApiOptionsWithId) => {
    const resp = await fetch(urlJoin(url, id), {
      method: "GET",
      ...(token && { headers: { Authorization: `Bearer ${token}` } }),
    });
    const respData = await resp.json();
    if (respData.error) throw new Error(respData.error);
    return respData;
  },
  patch: async ({ url, id, token, data }: ApiOptionsWithIdAndData) => {
    const resp = await fetch(urlJoin(url, id), {
      method: "PATCH",
      ...(token && { headers: { Authorization: `Bearer ${token}` } }),
      body: JSON.stringify(data),
    });
    const respData = await resp.json();
    if (respData.error) throw new Error(respData.error);
    return respData;
  },
  post: async ({ url, token, data }: ApiOptionsWithData) => {
    const resp = await fetch(`${url}`, {
      method: "POST",
      ...(token && { headers: { Authorization: `Bearer ${token}` } }),
      body: JSON.stringify(data),
    });
    const respData = await resp.json();
    if (respData.error) throw new Error(respData.error);
    return respData;
  },
  remove: async ({ url, id, token }: ApiOptionsWithId) => {
    const resp = await fetch(urlJoin(url, id), {
      method: "DELETE",
      ...(token && { headers: { Authorization: `Bearer ${token}` } }),
    });
    const respData = await resp.json();
    if (respData.error) throw new Error(respData.error);
    return true;
  },
  swr: (url: string, queryOptions: QueryOptions) => {
    const qs = queryOptions
      ? `?${queryString.stringify(queryOptions, { arrayFormat: "bracket" })}`
      : "";
    return useSWR(urlJoin(url, qs), fetcher);
  },
};

type ApiModelOptions = {
  apiBaseUrl?: string;
  key: string;
  path: string;
  schema: { db: z.ZodSchema };
  submodels?: Record<string, ApiModel>;
  token?: string;
  parentId?: string;
};

export class ApiModel {
  apiBaseUrl?: string;
  key: string;
  path: string; // api path with template preserved. e.g. {id}
  schema: { db: z.ZodSchema };
  submodels?: Record<string, ApiModel>;
  token?: string;
  parentId?: string;

  constructor({
    apiBaseUrl = "/api/",
    key,
    path,
    schema,
    token,
    submodels,
    parentId,
  }: ApiModelOptions) {
    this.apiBaseUrl = apiBaseUrl;
    this.key = key;
    this.path = path; // template preserved. may include {id}.
    this.schema = schema;
    this.token = token;
    this.submodels = submodels;
    this.parentId = parentId;
  }

  private getApiUrl() {
    let apiUrl = urlJoin(this.apiBaseUrl || "/api/", this.path);

    if (this.parentId) {
      apiUrl = apiUrl.replace("{id}", this.parentId);
    }

    return apiUrl;
  }

  async get({ queryOptions }: { queryOptions?: QueryOptions } = {}) {
    return await defaultCalls.get({
      url: this.getApiUrl(),
      queryOptions,
      token: this.token,
    });
  }

  async getById({ id }: { id: string }) {
    return await defaultCalls.getById({
      url: this.getApiUrl(),
      id,
      token: this.token,
    });
  }

  async patch({ id, data }: { id: string; data: Record<string, any> }) {
    return await defaultCalls.patch({
      url: this.getApiUrl(),
      id,
      data,
      token: this.token,
    });
  }

  async post({ data }: { data: Record<string, any> }) {
    return await defaultCalls.post({
      url: this.getApiUrl(),
      data,
      token: this.token,
    });
  }

  async remove({ id }: { id: string }) {
    return await defaultCalls.remove({
      url: this.getApiUrl(),
      id,
      token: this.token,
    });
  }

  set({ ...options }: Partial<ApiModelOptions>) {
    for (const key in options) {
      const value = options[key as keyof ApiModelOptions];
      if (value !== undefined) {
        (this as any)[key] = value;
      }
    }
  }

  swr(queryOptions: QueryOptions) {
    return defaultCalls.swr(this.getApiUrl(), queryOptions);
  }
}
