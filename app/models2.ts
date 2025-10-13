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
