import "dotenv/config";
import { initDb } from "@/lib/firebaseAdmin";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { solicitation as solModel } from "@/app/models";
import chalk from "chalk";

const BASE_URL = "http://localhost:3000";

const db = initDb();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY!);

async function isItBid(record: any): Promise<boolean> {
  const prompt = `
Given the following bid record, is it related to any of the following categories: ERP Consulting, ERP Upgrades, ERP Implementation, ERP Migration, ERP Integration, Infor Support ,Infor Consulting, Infor Managed Services, Infor CloudSuite Implementation, CloudSuite Implementation, Lawson Consulting, Lawson Managed Services, Workday HCM, Workday Migration, PeopleSoft Services, PeopleSoft Migration, PeopleSoft Support, Oracle ERP, PeopleSoft Services, IT Staffing, IT Services, IT Support, Information Technology Consulting, Managed IT services, System Modernization, Oracle Support, or Oracle Database Managed Services in the USA? 
Respond with yes or no

Record:
${JSON.stringify(record)}`; // and a short explanation

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
  const result = await model.generateContent(prompt);
  const text = result.response.text().toLowerCase();

  return text === "yes";
}

async function main() {
  const sols = await solModel.search({
    baseUrl: BASE_URL,
    limit: 1000,
    // filters: { cnStatus: "new" },
    token: process.env.DEV_TOKEN,
  });

  if (sols.error) console.error(sols.error);

  for (const sol of sols) {
    console.log("\n", sol.id, sol.title);

    // Run against AI
    const isIt = await isItBid(sol);
    console.log(`  isIt: ${isIt}`);

    if (!isIt) {
      await solModel.remove({
        id: sol.id,
        baseUrl: BASE_URL,
        token: process.env.SERVICE_KEY,
      });
      console.log(chalk.green("  Removed"));
      countDeleted++;
    }
  }
}

let countDeleted = 0;
const start = new Date();
performance.mark("start");

main()
  .catch((error: any) => console.error(chalk.red(`  ${error}`, error?.stack)))
  .finally(() => {
    performance.mark("end");
    const totalSec = (
      performance.measure("total-duration", "start", "end").duration / 1000
    ).toFixed(1);
    console.log(`\nTotal deleted: ${countDeleted}`);
    console.log(`Total time: ${totalSec}s ${new Date().toLocaleString()}`);
    process.exit(0);
  });
