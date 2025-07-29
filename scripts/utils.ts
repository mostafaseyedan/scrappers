import fs from "fs";
import { z } from "zod";
import chalk from "chalk";
import HyperAgent from "@hyperbrowser/agent";
import { ChatOpenAI } from "@langchain/openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

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

export function initHyperAgent(options: InitHyperAgentParams) {
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
Given the following bid record, is it related to any of the following categories: IT, IT staffing, software services, or managed services? 
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
