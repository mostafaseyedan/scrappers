import { z } from "zod";
import { db } from "@/lib/firebaseClient";
import { doc, getDoc } from "firebase/firestore";
import { cnStatuses } from "./config";

const solicitation: any = {
  schema: z.object({
    categories: z.array(z.string()).default([]),
    closingDate: z.string().datetime(),
    cnComments: z.array(z.object({})).default([]),
    cnData: z.object({}).default({}),
    cnLiked: z.boolean().default(false),
    cnModified: z.boolean().default(false),
    cnStatus: z.enum(Object.keys(cnStatuses)).default("new"),
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
    publicationDate: z.string().datetime(),
    questionsDueByDate: z.coerce
      .string()
      .pipe(
        z.transform((val) =>
          val.match(/^\d{4}-\d{2}-\d{2}/) ? new Date(val) : null
        )
      ),
    rfpType: z.coerce.string(),
    site: z.string(),
    siteData: z.any().default({}),
    siteId: z.string(),
    siteUrl: z.string().url(),
    title: z.string(),
    updated: z.string().datetime(),
    url: z.string().url(),
  }),
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
  remove: async (id: string) => {
    const resp = await fetch(`/api/solicitations/${id}`, {
      method: "DELETE",
    });
    const json = await resp.json();

    if (json.error) {
      throw new Error("Failed to delete solicitation");
    }

    return id;
  },
};

const solicitation_comment: any = {
  schema: z.object({
    body: z.string(),
    attachments: z.array(z.string().url()).default([]),
    authorId: z.string(),
  }),
  get: async (solId: string) => {},
  post: async (
    solId: string,
    data: z.infer<typeof solicitation_comment.schema>
  ) => {},
};

export { solicitation, solicitation_comment };
