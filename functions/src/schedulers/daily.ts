import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { runVendor } from "../http/playwright";
import "../config/firebase";

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
