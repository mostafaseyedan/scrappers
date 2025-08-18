import fs from "fs";
import { z } from "zod";
import chalk from "chalk";
import HyperAgent from "@hyperbrowser/agent";
import { ChatOpenAI } from "@langchain/openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { scriptLog as logModel } from "@/app/models";
import { secToTimeStr } from "@/lib/utils";

type EndScriptParams = {
  agent: any;
  baseUrl?: string;
  vendor: string;
  counts: {
    duplicates: number;
    success: number;
    fail: number;
    junk: number;
  };
};

type ExecuteTaskParams = {
  agent: any;
  name: string;
  task: any;
  folder: string;
  data?: Record<string, any>;
  outputSchema?: z.ZodTypeAny;
  hideSteps?: boolean;
};

type InitHyperAgentParams = {
  debug?: boolean;
  vendor: string;
};

const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY!);

export async function endScript({
  agent,
  baseUrl,
  vendor,
  counts,
}: EndScriptParams) {
  if (!vendor) throw new Error("Vendor is required for end function");

  performance.mark("end");
  const totalSec = Number(
    (
      performance.measure("total-duration", "start", "end").duration / 1000
    ).toFixed(0)
  );
  console.log(`\nCounts: ${JSON.stringify(counts, null, 2)}`);
  console.log(
    `Total time: ${secToTimeStr(totalSec)} ${new Date().toLocaleString()}`
  );

  await logModel.post({
    baseUrl,
    data: {
      message: `Scraped ${counts.success} solicitations from ${vendor}. 
        ${counts.fail > 0 ? `Found ${counts.fail} failures. ` : ""}
        ${
          counts.duplicates > 0 ? `Found ${counts.duplicates} duplicates. ` : ""
        }`,
      scriptName: `scrapers/${vendor}`,
      dupCount: counts.duplicates,
      successCount: counts.success,
      failCount: counts.fail,
      junkCount: counts.junk,
      timeStr: secToTimeStr(totalSec),
    },
    token: process.env.SERVICE_KEY,
  });

  await agent.closeAgent();

  await process.exit(0);
}

export async function executeTask({
  agent,
  name,
  task,
  folder,
  data = {},
  outputSchema,
  hideSteps = false,
}: ExecuteTaskParams) {
  let result;
  const subfolderName =
    data.rawSolId || JSON.stringify(data).replace(/[^a-z0-9\-]+/gi, "");
  const outputDir = `${folder}/${name}/${subfolderName}`;

  result =
    fs.existsSync(outputDir + "/output.json") &&
    fs.readFileSync(outputDir + "/output.json", "utf8");
  if (result) {
    console.log(`Cache found ${outputDir}/output.json`);
    return result;
  }

  result = await agent.executeTask(task, {
    onStep: (step: any) => {
      performance.mark(`${name}-step-${step.idx + 1}`);
      const duration =
        step.idx === 0
          ? performance.measure(
              `${name}-step-${step.idx + 1}-duration`,
              "start",
              `${name}-step-${step.idx + 1}`
            )
          : performance.measure(
              `${name}-step-${step.idx + 1}-duration`,
              `${name}-step-${step.idx}`,
              `${name}-step-${step.idx + 1}`
            );

      if (hideSteps) return;

      console.log(
        chalk.gray(`      ${(duration.duration / 1000).toFixed(1)}s`)
      );
      console.log(
        `    ${step.idx + 1}. ${step.agentOutput.actions[0].actionDescription}`
      );
    },
    debugDir: `${folder}/debug/${name}`,
    ...(outputSchema ? { outputSchema } : {}),
  });

  if (!result.output) {
    throw new Error("Unable to get JSON output from agent");
  }

  fs.mkdirSync(outputDir + "/", {
    recursive: true,
  });
  fs.writeFileSync(outputDir + "/output.json", result.output);

  return result.output;
}

export function getLatestFolder(folder: string): string {
  fs.mkdirSync(folder, { recursive: true });
  const folders = fs
    .readdirSync(folder)
    .filter(
      (f) =>
        f.match(/^\d{4}-\d{2}-\d{2}/) &&
        fs.statSync(`${folder}/${f}`).isDirectory()
    );
  if (folders.length === 0) return "";
  return folders[folders.length - 1];
}

export function initHyperAgent(options: InitHyperAgentParams) {
  if (options.debug === undefined) options.debug = false;

  const llm = new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: "gpt-4.1-mini",
    temperature: 0,
    cache: true,
  });

  const agent = new HyperAgent({
    llm,
    debug: options.debug,
    browserProvider: "Local",
    localConfig: {
      args: ["--deny-permission-prompts"],
      downloadsPath: `.output/${options.vendor}/tmp/downloads`,
    },
  });

  return agent;
}

export async function isItRelated(record: any): Promise<boolean> {
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

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout after ${ms}ms`));
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}
