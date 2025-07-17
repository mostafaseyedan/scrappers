import { z } from "zod";
import { db } from "@/lib/firebaseClient";
import { doc, getDoc } from "firebase/firestore";

const solicitation = {
  schema: z.object({
    url: z.string().url(),
    title: z.string(),
    description: z.string(),
    location: z.string(),
    issuingOrganization: z.string(),
    publicationDate: z.string().datetime(),
    closingDate: z.string().datetime(),
    questionsDueByDate: z.coerce
      .string()
      .pipe(
        z.transform((val) =>
          val.match(/^\d{4}-\d{2}-\d{2}/) ? new Date(val) : null
        )
      ),
    contactName: z.string(),
    contactEmail: z.string(),
    contactPhone: z.string(),
    contactNote: z.string(),
    externalLinks: z.array(z.string().url()).default([]),
    categories: z.array(z.string()).default([]),
    documents: z.array(z.string().url()).default([]),
    siteData: z.any().default({}),
    site: z.string(),
    siteId: z.string(),
    siteUrl: z.string().url(),
    keywords: z.array(z.string()).default([]),
    rfpType: z.coerce.string(),
    cnStatus: z.enum(["new", "ignored", "process", "applied"]).default("new"),
    cnData: z.object({}).default({}),
    cnLiked: z.boolean().default(false),
    cnModified: z.boolean().default(false),
    created: z.string().datetime(),
    updated: z.string().datetime(),
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
  post: (data: z.infer<typeof solicitation.schema>) => {},
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
  remove: (id: string) => {},
};

export { solicitation };
