import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { runVendor } from "../http/playwright";
import "../config/firebase";

const BASE_URL = "https://reconrfp.cendien.com";

export const daily = onSchedule(
  {
    schedule: "0 0 * * 1,3,5", // Every Monday, Wednesday, and Friday at midnight (UTC)
    timeZone: "UTC",
    retryCount: 0,
    secrets: [
      "DEV_BIDDIRECT_USER",
      "DEV_BIDDIRECT_PASS",
      "DEV_BIDSYNC_USER",
      "DEV_BIDSYNC_PASS",
      "DEV_BROWSERBASE_KEY",
      "DEV_GEMINI_KEY",
      "DEV_INSTANTMARKETS_USER",
      "DEV_INSTANTMARKETS_PASS",
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
    logger.info("Daily jobs triggered", { scheduleTime: event.scheduleTime });

    const vendors: Array<Parameters<typeof runVendor>[0]> = [
      "biddirect",
      "bidsync",
      "instantmarkets",
      "publicpurchase",
      // "techbids", // trial
      "vendorregistry",
      "vendorline",
    ];

    const limit = Math.max(
      1,
      parseInt(process.env.VENDOR_CONCURRENCY || "2", 10) || 3
    );

    logger.info("Starting vendor runs", {
      vendors,
      concurrency: limit,
    });

    async function runWithConcurrency<T>(
      items: string[],
      fn: (item: string) => Promise<T>,
      concurrency: number
    ) {
      const results: Record<string, { ok: boolean; data?: T; error?: any }> =
        {};
      let index = 0;
      async function worker() {
        while (index < items.length) {
          const i = index++;
          const item = items[i];
          try {
            logger.info("Vendor start", { vendor: item });
            const data = await fn(item);
            results[item] = { ok: true, data };
            logger.info("Vendor done", {
              vendor: item,
              status: (data as any).status,
            });
          } catch (error: any) {
            results[item] = {
              ok: false,
              error: error?.message || String(error),
            };
            logger.error("Vendor failed", { vendor: item, error });
          }
        }
      }
      const workers = Array.from(
        { length: Math.min(concurrency, items.length) },
        () => worker()
      );
      await Promise.all(workers);
      return results;
    }

    const results = await runWithConcurrency(
      vendors,
      (vendor) => runVendor(vendor as any, { ...process.env, BASE_URL }),
      limit
    );

    logger.info("All vendors finished", { results });
  }
);
