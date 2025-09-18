import "dotenv/config";
import {
  solicitation as solicitationModel,
  stat as statModel,
} from "@/app/models";
import chalk from "chalk";
import { format as $d, addDays, set as dSet } from "date-fns";

/*
  This script fetches the most recent 1000 solicitations (sorted by created desc)
  and aggregates counts per day. It then upserts a stat record for each day with the
  total number of solicitations created on that date.

  Stat key pattern:
    solicitationCreated/<YYYY-MM-DD>
  parentKey:
    solicitationCreated
  periodType:
    day
*/

async function run() {
  const baseUrl = process.env.BASE_URL;

  // Fetch last 1000 solicitations sorted by created desc
  const respSols = await solicitationModel.get({
    baseUrl,
    limit: 1000,
    sort: "created desc",
    token: process.env.SERVICE_KEY,
  });
  const solicitations = respSols.results?.length ? respSols.results : [];

  console.log(`${solicitations.length} solicitations fetched (latest first)`);

  const dailyCounts: Record<string, any> = {};
  for (const sol of solicitations) {
    const dateStr = $d(new Date(sol.created), "yyyy-MM-dd");

    if (!dailyCounts[dateStr]) {
      dailyCounts[dateStr] = {};
    }

    if (!dailyCounts[dateStr][sol.site]) {
      dailyCounts[dateStr][sol.site] = 0;
    }

    dailyCounts[dateStr][sol.site] += 1;
  }

  console.log("Daily solicitation counts:", dailyCounts);

  for (const [dateStr, vendorCounts] of Object.entries(dailyCounts)) {
    for (const [vendor, count] of Object.entries(vendorCounts)) {
      if (count === 0) continue;

      const key = `scraperSuccess/${vendor}/${dateStr}`;
      const startDate = dSet(new Date(dateStr), {
        hours: 0,
        minutes: 0,
        seconds: 0,
        milliseconds: 0,
      });
      const endDate = addDays(startDate, 1);

      const data = {
        key,
        parentKey: "scraperSuccess",
        value: count,
        periodType: "day",
        startDate,
        endDate,
      };

      try {
        const saved = await statModel.upsertByKey({
          baseUrl,
          key,
          data,
          token: process.env.SERVICE_KEY,
        });
        console.log(`${saved.key}: ${saved.value}`);
      } catch (err: any) {
        console.error(
          chalk.red(
            `Failed to upsert stat for ${dateStr}: ${err?.message || err}`
          )
        );
      }
    }
  }
}

run()
  .catch((error: any) => console.error(chalk.red(`  ${error?.stack || error}`)))
  .finally(async () => {
    console.log("Done");
    process.exit(0);
  });
