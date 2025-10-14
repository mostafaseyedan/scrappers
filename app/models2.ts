import { z } from "zod";
import { ApiModel } from "au/api";

export const chat_message = new ApiModel({
  key: "chat_messages",
  path: "chats/{id}/messages",
  schema: {
    db: z.object({
      senderId: z.string(),
      content: z.string(),
    }),
  },
});

export const chat_participant = new ApiModel({
  key: "chat_participants",
  path: "chats/{id}/participants",
  schema: {
    db: z.object({
      userId: z.string(),
      status: z.enum(["online", "offline", "busy", "away"]).default("offline"),
    }),
  },
});

export const chat = new ApiModel({
  key: "chats",
  path: "chats",
  submodels: {
    participants: chat_participant,
    messages: chat_message,
  },
  schema: {
    db: z.object({
      name: z.string(),
      key: z.string().describe("[unique]"),
      description: z.string(),
      messages: z
        .array(chat_message.schema.db)
        .default([])
        .describe("[submodel]"),
      participants: z
        .array(chat_participant.schema.db)
        .default([])
        .describe("[submodel]"),
    }),
  },
});

export const contact = new ApiModel({
  key: "contacts",
  path: "contacts",
  schema: {
    db: z.object({
      firstName: z.string(),
      lastName: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      company: z.string().optional(),
      notes: z.string().optional(),
    }),
  },
});

export const knowledgeTopic_item = new ApiModel({
  key: "knowledgeTopic_items",
  path: "knowledgeTopics/{id}/items",
  schema: {
    db: z.object({
      question: z.string(),
      answer: z.string(),
      source: z.string().optional(),
    }),
  },
});

export const knowledgeTopic = new ApiModel({
  key: "knowledgeTopics",
  path: "knowledgeTopics",
  submodels: {
    items: knowledgeTopic_item,
  },
  schema: {
    db: z.object({
      name: z.string(),
      description: z.string().optional(),
      items: z
        .array(knowledgeTopic_item.schema.db)
        .default([])
        .describe("[submodel]"),
    }),
  },
});

export const table_row = new ApiModel({
  key: "table_rows",
  path: "tables/{id}/rows",
  schema: {
    db: z.object({
      col1: z.string().optional(),
      col2: z.string().optional(),
      col3: z.string().optional(),
      col4: z.string().optional(),
      col5: z.string().optional(),
    }),
  },
});

export const table = new ApiModel({
  key: "tables",
  path: "tables",
  submodels: {
    rows: table_row,
  },
  schema: {
    db: z.object({
      name: z.string(),
      description: z.string().optional(),
      columns: z.array(z.string()).default([]),
      rows: z.array(table_row.schema.db).default([]).describe("[submodel]"),
    }),
  },
});
