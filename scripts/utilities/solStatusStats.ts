import "dotenv/config";
import { solicitation_log as solLog, stat as statModel } from "@/app/models";
import chalk from "chalk";
import { format as $d, addDays, subDays, set as dSet } from "date-fns";

async function run() {
  const baseUrl = process.env.BASE_URL;
  const dailyStats: Record<string, any> = {};
  const total = 30000;

  // Get all logs for the last 3 months
  const respLogs = await solLog.getAll({
    baseUrl,
    limit: total,
    token: process.env.SERVICE_KEY,
  });
  let logs = respLogs.results?.length ? respLogs.results : [];
  logs = logs.filter(
    (log) =>
      log.actionType === "update" && log.actionData?.cnStatus === "pursuing"
  );
  logs.sort((a, b) => (a.created < b.created ? 1 : -1));

  console.log(`${logs.length} out of ${total} records`);

  for (const log of logs) {
    const dateStr = $d(log.created, "yyyy-MM-dd");

    if (!dailyStats[dateStr]) {
      dailyStats[dateStr] = 0;
    }

    dailyStats[dateStr] += 1;
  }

  console.log("\nDaily stats:", dailyStats);

  for (const [dateStr, count] of Object.entries(dailyStats)) {
    if (count === 0) continue;

    const key = `updateCnStatusToPursuing/${dateStr}`;
    const newData = {
      key,
      parentKey: "updateCnStatusToPursuing",
      value: count,
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
      baseUrl,
      key,
      data: newData,
      token: process.env.SERVICE_KEY,
    });
    console.log(`${checkStat.key}: ${checkStat.value}`);
  }
}

run()
  .catch((error: any) => console.error(chalk.red(`  ${error?.stack || error}`)))
  .finally(async () => {
    console.log("Done");
    process.exit(0);
  });
