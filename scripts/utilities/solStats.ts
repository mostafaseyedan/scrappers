import "dotenv/config";
import { scriptLog as scriptLogModel, stat as statModel } from "@/app/models";
import chalk from "chalk";
import { format as $d, addDays, subDays, set as dSet } from "date-fns";

async function run() {
  const startDate = subDays(new Date(), 90);
  const endDate = addDays(new Date(), 2);
  const created = `> ${$d(startDate, "yyyy-MM-dd")} AND < ${$d(
    endDate,
    "yyyy-MM-dd"
  )}`;
  const dailyStats: Record<string, any> = {};

  // Get all logs for the last 3 months
  const respLogs = await scriptLogModel.get({
    baseUrl: "http://localhost:3000",
    limit: 0,
    filters: {
      created,
    },
    token: process.env.SERVICE_KEY,
  });
  const logs = respLogs.results?.length ? respLogs.results : [];

  console.log(
    `${logs.length} logs found from ${$d(startDate, "yyyy-MM-dd")} to ${$d(
      endDate,
      "yyyy-MM-dd"
    )}`
  );

  for (const log of logs) {
    const dateStr = $d(log.created, "yyyy-MM-dd");
    const vendor = log.scriptName.substring(9);

    if (!dailyStats[dateStr]) {
      dailyStats[dateStr] = {};
    }

    if (!dailyStats[dateStr][vendor]) {
      dailyStats[dateStr][vendor] = {
        success: 0,
      };
    }

    dailyStats[dateStr][vendor].success += log.successCount || 0;
  }

  console.log("\nDaily stats:", dailyStats);
  for (const [dateStr, successCounts] of Object.entries(dailyStats)) {
    for (const [vendor, data] of Object.entries(successCounts)) {
      const statData = data as { success: number };
      if (statData.success === 0) continue;

      const key = `scrapers/${vendor}/${dateStr}`;
      const newData = {
        key,
        value: statData.success,
        periodType: "day",
        startDate: dSet(new Date(dateStr), {
          hours: 0,
          minutes: 0,
          seconds: 0,
        }),
        endDate: addDays(
          dSet(new Date(dateStr), { hours: 0, minutes: 0, seconds: 0 }),
          1
        ),
      };
      const checkStat = await statModel.upsertByKey({
        baseUrl: "http://localhost:3000",
        key,
        data: newData,
        token: process.env.SERVICE_KEY,
      });
      console.log(`${checkStat.key}: ${checkStat.value}`);
    }
  }
}

run()
  .catch((error: any) => console.error(chalk.red(`  ${error?.stack || error}`)))
  .finally(async () => {
    console.log("Done");
    process.exit(0);
  });
