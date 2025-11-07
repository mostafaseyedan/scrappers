import { isNotExpired, isSolDuplicate } from "../../../lib/script";
import { solicitation as solModel } from "../../../models";
import { sanitizeDateString } from "../../../lib/utils";
import { logger } from "firebase-functions";
import type { BrowserContext, Locator, Page } from "playwright-core";

let failCount = 0;
let successCount = 0;
let expiredCount = 0;
let nonItCount = 0;
let dupCount = 0;

async function processRow(row: Locator, env: Record<string, any>) {
  const title = await row
    .locator(".accordion_header")
    .innerText()
    .catch(() => "");

  if (!title) return false;

  const id = await row.getAttribute("id");
  let content = await row.locator(".accordion_content").innerText();
  content = content
    .replace(/[\n|\t]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  const issuer = content
    .match(/Lead Agency:\s*(.*?)\s*Responses* Due:/)?.[1]
    ?.trim();
  let closingDate = content.match(/Responses* Due:\s*(.*?)\s*[A|P]M/)?.[1];
  if (closingDate?.includes(",")) {
    const parts = closingDate.split(",");
    closingDate = parts[1].trim() + "," + parts[2].trim();
    closingDate = sanitizeDateString(closingDate) || "";
  }

  const siteUrl = await row.locator("a").first().getAttribute("href");
  const sol = {
    title,
    issuer,
    ...(closingDate && { closingDate }),
    site: "omniapartners",
    siteUrl,
    siteId: "omniapartners-" + id?.match(/(\d+)/)?.[0],
  };

  if (sol.closingDate && !isNotExpired(sol)) {
    expiredCount++;
    return false;
  }

  const isDup = await isSolDuplicate(sol, env.BASE_URL, env.SERVICE_KEY).catch(
    (err) => {
      logger.error("isSolDuplicate failed", err, sol);
      failCount++;
    }
  );
  if (isDup) {
    dupCount++;
    return false;
  }

  const newRecord = await solModel
    .post({
      baseUrl: env.BASE_URL,
      data: sol,
      token: env.SERVICE_KEY,
    })
    .catch((err: unknown) => {
      logger.error("Failed to save sol", err, sol);
      failCount++;
    });
  successCount++;
  logger.log(`Saved sol: ${newRecord.id}`);

  return newRecord;
}

async function scrapeAllSols(page: Page, env: Record<string, any>) {
  let allSols: Record<string, any>[] = [];

  await page.goto("https://info.omniapartners.com/solicitations", {
    waitUntil: "domcontentloaded",
  });

  logger.log(`${env.VENDOR}`);
  await page.waitForSelector("[id^='hs_cos_wrapper_module_']").catch(() => {});
  const rows = await page.locator("[id^='hs_cos_wrapper_module_']");
  const rowCount = await rows.count();

  if (rowCount === 0) {
    return allSols;
  }

  for (let i = 0; i < rowCount; i++) {
    const row = rows.nth(i);
    const sol = await processRow(row, env).catch((err) =>
      logger.error("processRow failed", err)
    );
    if (sol) allSols.push(sol);

    if (expiredCount >= 3 || dupCount >= 3) {
      logger.log(
        `Stopping ${env.VENDOR} due to too many expired or duplicate sols`
      );
      break;
    }
  }

  return allSols;
}

export async function run(
  page: Page,
  env: Record<string, any> = {},
  context: BrowserContext
) {
  const BASE_URL = env.BASE_URL!;
  const SERVICE_KEY = env.DEV_SERVICE_KEY!;
  const VENDOR = "omniapartners";
  let results = {};

  const sols: string[] = (
    await scrapeAllSols(page, {
      ...env,
      BASE_URL,
      VENDOR,
      SERVICE_KEY,
    })
  ).map((s) => s.id);

  logger.log(
    `${VENDOR} - Finished saving sols. Success: ${successCount}. Fail: ${failCount}. Duplicates: ${dupCount}. Junk: ${
      expiredCount + nonItCount
    }.`
  );

  results = {
    sols,
    counts: {
      success: successCount,
      fail: failCount,
      dup: dupCount,
      junk: expiredCount + nonItCount,
    },
  };

  return results;
}
