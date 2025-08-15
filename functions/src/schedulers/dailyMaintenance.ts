import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";

// Ensure Firebase Admin initialized (side-effect import pattern)
import "../config/firebase";
import { db } from "../config/firebase";

// Scheduled (cron) function: runs every 10 minutes.
// Safe default implementation just logs a heartbeat so you can verify scheduling.
// Extend this to perform maintenance tasks (e.g., purge old docs, aggregate stats, etc.).
//
// CRON format: minute hour day-of-month month day-of-week
// Current schedule: */10 * * * *  => every 10 minutes (UTC)
export const dailymaintenance = onSchedule(
  {
    schedule: "0 0 * * *", // Every day at midnight UTC
    timeZone: "UTC", // Adjust if a specific local timezone is required
    retryCount: 3, // Basic retry; adjust/remove based on idempotency of your task
    secrets: ["DEV_OPENAI_API_KEY"], // Bind secret so it's available at runtime
  },
  async (event) => {
    logger.info("Maintenance job (daily interval) triggered", {
      scheduleTime: event.scheduleTime,
    });

    // Skip if secret missing (local emulator without secret set)
    const apiKey = process.env.DEV_OPENAI_API_KEY;
    if (!apiKey) {
      logger.warn("DEV_OPENAI_API_KEY not set; skipping ChatGPT call.");
      return;
    }

    try {
      const note = await generateMaintenanceNote(apiKey);
      logger.info("Received maintenance note", { preview: note?.slice(0, 80) });
      await db.collection("maintenanceLogs").add({
        createdAt: new Date().toISOString(),
        note,
        scheduleTime: event.scheduleTime,
      });
    } catch (err) {
      logger.error("Failed to generate maintenance note", {
        error: (err as Error).message,
      });
    }
  }
);

async function generateMaintenanceNote(apiKey: string): Promise<string> {
  const body = {
    model: "gpt-4o-mini", // Adjust model as needed
    messages: [
      {
        role: "system",
        content:
          "You are an assistant that produces concise maintenance insights.",
      },
      {
        role: "user",
        content:
          "Provide one short (<=140 chars) motivational operations / reliability tip.",
      },
    ],
    temperature: 0.7,
    max_tokens: 60,
  };

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OpenAI API error ${resp.status}: ${text}`);
  }
  const json: any = await resp.json();
  return json.choices?.[0]?.message?.content?.trim() || "(no content)";
}

// Example of how you might structure a cleanup (keep pure & testable):
// async function cleanupOldDocuments() {
//   const cutoff = Date.now() - 1000 * 60 * 60 * 24 * 30; // 30 days
//   const snap = await db.collection("testmessages").where("createdAt", "<", cutoff).get();
//   const batch = db.batch();
//   snap.docs.forEach((d) => batch.delete(d.ref));
//   if (!snap.empty) await batch.commit();
//   logger.info("Deleted old documents", { count: snap.size });
// }
