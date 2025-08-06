import "dotenv/config";
import { solicitation } from "../../app/models";
import fs from "fs";
import path from "path";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const TOKEN = process.env.SERVICE_KEY;

async function uploadBidsyncJson() {
  // Path to the JSON file
  const filePath = path.resolve(
    __dirname,
    "../../.output/bidsync/2025-08-06.json"
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
        console.log("  Record already exists ", checkRecord.results[0].id);

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
      console.log("  Uploaded ", result.id);
    } catch (err) {
      console.error("  Failed to upload record:", err);
    }
  }
}

uploadBidsyncJson();
