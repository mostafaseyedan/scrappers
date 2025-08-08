import "dotenv/config";
import { solicitation, scriptLog as logModel } from "@/app/models";
import fs from "fs";
import path from "path";
import chalk from "chalk";
import { secToTimeStr } from "@/lib/utils";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const TOKEN = process.env.SERVICE_KEY;
const VENDOR = "bidmain";

async function uploadBidsyncJson() {
  // Path to the JSON file
  const filePath = path.resolve(
    __dirname,
    `../../.output/${VENDOR}/2025-08-08.json`
  );
  const fileContent = fs.readFileSync(filePath, "utf-8");
  const records = JSON.parse(fileContent);

  for (const record of records) {
    try {
      console.log(`\n${record.siteId} - ${record.title}`);

      const checkRecord = await solicitation.get({
        baseUrl: BASE_URL,
        token: TOKEN,
        filters: { siteId: record.siteId },
      });

      if (checkRecord.results?.length) {
        console.log(
          chalk.grey("  Record already exists ", checkRecord.results[0].id)
        );
        dupCount++;

        await solicitation.patch({
          id: checkRecord.results[0].id,
          baseUrl: BASE_URL,
          token: TOKEN,
          data: { ...record },
        });
        console.log("  Updated existing record");

        continue; // Skip if the record already exists
      }

      // Remove any fields not needed by the API if necessary
      // e.g., delete record.id;
      const result = await solicitation.post({
        baseUrl: BASE_URL,
        token: TOKEN,
        data: record,
      });
      console.log(chalk.green("  Saved", result.id));
      successCount++;
    } catch (err) {
      console.error(chalk.red("  Failed to upload record:", err));
      failCount++;
    }
  }
}

let dupCount = 0;
let failCount = 0;
let successCount = 0;
let junkCount = 0;
performance.mark("start");

uploadBidsyncJson()
  .catch((error: any) => console.error(chalk.red(`  ${error}`, error?.stack)))
  .finally(async () => {
    performance.mark("end");
    const totalSec = Number(
      (
        performance.measure("total-duration", "start", "end").duration / 1000
      ).toFixed(0)
    );

    console.log(
      `\nTotal time: ${secToTimeStr(totalSec)} ${new Date().toLocaleString()}`
    );
    console.log(
      `Success: ${successCount}, Failures: ${failCount}, Duplicates: ${dupCount}, Junk: ${junkCount}`
    );

    await logModel.post({
      baseUrl: BASE_URL,
      data: {
        message: `Scrapped ${successCount} solicitations from ${VENDOR}. 
            ${failCount > 0 ? `Found ${failCount} failures. ` : ""}
            ${dupCount > 0 ? `Found ${dupCount} duplicates. ` : ""}`,
        scriptName: `scrapers/${VENDOR}`,
        dupCount,
        successCount,
        failCount,
        junkCount,
        timeStr: secToTimeStr(totalSec),
      },
      token: process.env.SERVICE_KEY,
    });
  });
