import fs from "fs";
import { z } from "zod";
import chalk from "chalk";

type ExecuteTaskParams = {
  agent: any;
  name: string;
  task: any;
  folder: string;
  data?: Record<string, any>;
  outputSchema?: z.ZodTypeAny;
  hideSteps?: boolean;
};

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
  if (result) return result;

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
