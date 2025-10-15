import "dotenv/config";
import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";

async function main() {
  const stagehand = new Stagehand({
    env: "BROWSERBASE",
    apiKey: process.env.BROWSERBASE_KEY!,
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
  });

  await stagehand.init();
  const page = stagehand.page;

  await page.goto("https://example.com");

  // Act on the page
  await page.act("Click the sign in button");

  // Extract structured data
  const { title } = await page.extract({
    instruction: "extract the page title",
    schema: z.object({
      title: z.string(),
    }),
  });

  console.log(title);
  await stagehand.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
