import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { runVendor } from "../http/playwright";

// Ensure Firebase Admin initialized (side-effect import pattern)
import "../config/firebase";

// Scheduled (cron) function: runs every 10 minutes.
// Safe default implementation just logs a heartbeat so you can verify scheduling.
// Extend this to perform maintenance tasks (e.g., purge old docs, aggregate stats, etc.).
//
// CRON format: minute hour day-of-month month day-of-week
// Current schedule: */10 * * * *  => every 10 minutes (UTC)
export const daily = onSchedule(
  {
    schedule: "0 * * * *", // Every hour at minute 0 (UTC)
    timeZone: "UTC",
    retryCount: 3,
    secrets: [
      "DEV_BIDDIRECT_USER",
      "DEV_BIDDIRECT_PASS",
      "DEV_BIDSYNC_USER",
      "DEV_BIDSYNC_PASS",
      "DEV_GEMINI_KEY",
      "DEV_PUBLICPURCHASE_USER",
      "DEV_PUBLICPURCHASE_PASS",
      "DEV_SERVICE_KEY",
      "DEV_TECHBIDS_USER",
      "DEV_TECHBIDS_PASS",
      "DEV_VENDORREGISTRY_USER",
      "DEV_VENDORREGISTRY_PASS",
      "DEV_VENDORLINE_USER",
      "DEV_VENDORLINE_PASS",
    ],
    memory: "1GiB",
    timeoutSeconds: 3600,
  },
  async (event) => {
    logger.info("Hourly jobs triggered", {
      scheduleTime: event.scheduleTime,
    });

    await runVendor("biddirect", { ...process.env });
  }
);

// Example of how you might structure a cleanup (keep pure & testable):
// async function cleanupOldDocuments() {
//   const cutoff = Date.now() - 1000 * 60 * 60 * 24 * 30; // 30 days
//   const snap = await db.collection("testmessages").where("createdAt", "<", cutoff).get();
//   const batch = db.batch();
//   snap.docs.forEach((d) => batch.delete(d.ref));
//   if (!snap.empty) await batch.commit();
//   logger.info("Deleted old documents", { count: snap.size });
// }
