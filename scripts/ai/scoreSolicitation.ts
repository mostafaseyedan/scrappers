/// <reference types="node" />
import "dotenv/config";
import chalk from "chalk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { solicitation as solModel } from "../../app/models";

type CohortExample = Record<string, any>;

type LlmResult = {
  llmScore: number; // 0..1 likelihood this is worth pursuing
  rationale: string;
};

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const SERVICE_KEY = process.env.SERVICE_KEY || process.env.MOHAMMAD_KEY;
const GEMINI_KEY = process.env.GEMINI_KEY;

if (!SERVICE_KEY) {
  console.error(
    chalk.red(
      "Missing SERVICE_KEY (or MOHAMMAD_KEY) in env. This script authenticates against the app API using that key."
    )
  );
  process.exit(1);
}

if (!GEMINI_KEY) {
  console.error(
    chalk.red(
      "Missing GEMINI_KEY in env. Set it to use Google Generative AI (Gemini)."
    )
  );
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_KEY);

function parseArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a: string) => a.startsWith(prefix));
  return arg?.slice(prefix.length);
}

function summarize(rec: any): CohortExample {
  // Return the full record JSON so the LLM considers all fields holistically.
  // Ensure an id is present for reference.
  if (!rec.id && rec.key) rec.id = rec.key;
  return rec;
}

function truncate(str: string, n = 1200) {
  if (!str) return str;
  return str.length > n ? str.slice(0, n) + "…" : str;
}

function containsAny(hay: string, needles: string[]): boolean {
  const lower = hay.toLowerCase();
  return needles.some((n) => lower.includes(n.toLowerCase()));
}

function detectTexasBoost(
  loc?: string,
  text?: string
): { hit: boolean; boost: number; reason: string } {
  const texasCities = [
    "Austin",
    "Dallas",
    "Houston",
    "San Antonio",
    "Fort Worth",
    "El Paso",
    "Plano",
    "Arlington",
    "Corpus Christi",
    "Lubbock",
  ];
  const hay = `${loc || ""} ${text || ""}`;
  const isTX = containsAny(hay, [
    " texas ",
    " tx ",
    "(tx)",
    " tx,",
    " state of texas ",
    "tx-",
  ]);
  const cityHit = texasCities.some((c) =>
    new RegExp(`\\b${c}\\b`, "i").test(hay)
  );
  const hit = Boolean(isTX || cityHit);
  const boost = hit ? 0.15 : 0;
  const reason = hit
    ? "Texas location or city detected"
    : "No Texas proximity detected";
  return { hit, boost, reason };
}

function detectRemoteBoost(text?: string): {
  hit: boolean;
  boost: number;
  reason: string;
} {
  const hay = text || "";
  const hit = containsAny(hay, [
    "remote",
    "virtual",
    "telework",
    "work from home",
    "no onsite",
    "offsite",
    "online only",
  ]);
  const boost = hit ? 0.1 : 0;
  const reason = hit
    ? "Remote-friendly language detected"
    : "No clear remote language";
  return { hit, boost, reason };
}

function detectErpBoost(text?: string): {
  hit: boolean;
  boost: number;
  reason: string;
  matched: string[];
} {
  const erpNeedles = [
    "erp",
    "infor",
    "lawson",
    "workday",
    "peoplesoft",
    "oracle",
    "sap",
    "netsuite",
    "dynamics",
    "cloudsuite",
  ];
  const bag = `${text || ""}`;
  const matched = erpNeedles.filter((n) => containsAny(bag, [n]));
  const hit = matched.length > 0;
  const boost = hit ? 0.2 : 0;
  const reason = hit
    ? `ERP-related terms found (${matched.join(", ")})`
    : "No ERP terms found";
  return { hit, boost, reason, matched };
}

function parseBudgetFromText(text?: string): number | null {
  if (!text) return null;
  // Look for patterns like $1,234,567 or $1.2M etc.
  const dollarRegex =
    /(\$\s?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(?:\.[0-9]{1,2})?)/i;
  const millionRegex = /(\$?\s?([0-9]+(?:\.[0-9]+)?)\s?(million|m)\b)/i;
  const m = millionRegex.exec(text);
  if (m) {
    const val = parseFloat(m[2]);
    return Math.round(val * 1_000_000);
  }
  const d = dollarRegex.exec(text);
  if (d) {
    const raw = d[2].replace(/,/g, "");
    const val = parseFloat(raw);
    if (!isNaN(val)) return Math.round(val);
  }
  return null;
}

function budgetBoost(budget: number | null): { boost: number; reason: string } {
  if (!budget || isNaN(budget))
    return { boost: 0, reason: "No budget detected" };
  if (budget >= 1_000_000)
    return { boost: 0.2, reason: `High budget: ~$${budget.toLocaleString()}` };
  if (budget >= 500_000)
    return {
      boost: 0.15,
      reason: `Mid-high budget: ~$${budget.toLocaleString()}`,
    };
  if (budget >= 100_000)
    return {
      boost: 0.1,
      reason: `Medium budget: ~$${budget.toLocaleString()}`,
    };
  if (budget >= 50_000)
    return {
      boost: 0.05,
      reason: `Entry budget: ~$${budget.toLocaleString()}`,
    };
  return { boost: 0, reason: `Low budget: ~$${budget.toLocaleString()}` };
}

async function llmScore(
  target: CohortExample,
  positives: CohortExample[],
  negatives: CohortExample[]
): Promise<LlmResult> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
  const prompt = `You are helping decide if a new government solicitation is worth pursuing.
We provide examples of past solicitations that were pursued (positives) and not pursued (negatives).
Using ONLY the textual similarity and thematic alignment, predict a probability (0..1) that the TARGET should be pursued.

Return STRICT JSON with keys: {"llmScore": number between 0 and 1, "rationale": short string}. Do not add extra text.

TARGET:\n${JSON.stringify(
    target
  )}\n\nPOSITIVE_EXAMPLES (pursuing):\n${JSON.stringify(
    positives
  )}\n\nNEGATIVE_EXAMPLES (notPursuing):\n${JSON.stringify(negatives)}\n`;

  const res = await model.generateContent(prompt);
  const text = (res.response.text() || "").trim();
  // Attempt to parse JSON even if wrapped in fences
  const jsonStr = text.replace(/^```json\n?|```$/g, "");
  try {
    const parsed = JSON.parse(jsonStr);
    const s = Math.max(0, Math.min(1, Number(parsed.llmScore)));
    return {
      llmScore: isNaN(s) ? 0.5 : s,
      rationale: String(parsed.rationale || ""),
    };
  } catch (e) {
    // Fallback heuristic if LLM didn't return JSON
    return {
      llmScore: 0.5,
      rationale: "LLM parsing failed; defaulting to neutral",
    };
  }
}

async function main() {
  const solId = parseArg("solId");
  if (!solId) {
    console.error(
      chalk.red("Usage: tsx scripts/ai/scoreSolicitation.ts --solId=<id>")
    );
    process.exit(1);
  }

  console.log(chalk.cyan(`Scoring solicitation: ${solId}`));

  // 1) Fetch target solicitation
  const targetResp = await solModel.getById({
    id: solId,
    baseUrl: BASE_URL,
    token: SERVICE_KEY,
  });
  if ((targetResp as any).error) {
    console.error(
      chalk.red(
        `Failed to fetch solicitation ${solId}: ${(targetResp as any).error}`
      )
    );
    process.exit(1);
  }
  const target = targetResp;

  // 2) Fetch cohorts
  const [pursueList, notPursueList] = await Promise.all([
    solModel.get({
      baseUrl: BASE_URL,
      token: SERVICE_KEY,
      limit: 200,
      sort: "updated desc",
      filters: { cnStatus: "pursuing" },
    }),
    solModel.get({
      baseUrl: BASE_URL,
      token: SERVICE_KEY,
      limit: 200,
      sort: "updated desc",
      filters: { cnStatus: "notPursuing" },
    }),
  ]);

  const posExamples: CohortExample[] = (pursueList?.results || [])
    .slice(0, 8)
    .map(summarize);
  const negExamples: CohortExample[] = (notPursueList?.results || [])
    .slice(0, 8)
    .map(summarize);

  // 3) LLM score
  const targetSummary = summarize(target);
  const llm = await llmScore(targetSummary, posExamples, negExamples);

  // 4) Rule-based boosts
  const textBlob = JSON.stringify(target);
  const texas = detectTexasBoost(target.location, textBlob);
  const remote = detectRemoteBoost(textBlob);
  const erp = detectErpBoost(textBlob);

  // Budget: 1) try regex, 2) optional LLM if regex fails
  let detectedBudget = parseBudgetFromText(textBlob);
  if (!detectedBudget) {
    // Optional: ask LLM to extract a budget amount if explicitly mentioned
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    const budgetPrompt = `Extract the estimated total contract value or budget in USD if explicitly mentioned in the following text. If unknown, return 0. Return ONLY a number.\n\nText:\n${truncate(
      textBlob,
      4000
    )}`;
    try {
      const r = await model.generateContent(budgetPrompt);
      const v = parseInt((r.response.text() || "0").replace(/[^0-9]/g, ""), 10);
      detectedBudget = Number.isFinite(v) && v > 0 ? v : null;
    } catch {}
  }
  const budget = budgetBoost(detectedBudget);

  // 5) Blend
  const ruleScore = texas.boost + remote.boost + erp.boost + budget.boost; // up to ~0.65
  const finalScore = Math.max(0, Math.min(1, llm.llmScore * 0.6 + ruleScore));

  // 6) Report
  console.log("");
  console.log(chalk.bold(target.title || "(untitled)"));
  if (target.location) console.log("  Location:", target.location);
  if (Array.isArray(target.keywords) && target.keywords.length)
    console.log("  Keywords:", target.keywords.slice(0, 12).join(", "));
  if (target.cnType) console.log("  Type:", target.cnType);

  console.log("");
  console.log(chalk.yellow("LLM score:"), llm.llmScore.toFixed(3));
  console.log("  Rationale:", llm.rationale || "(none)");
  console.log("");
  console.log(chalk.yellow("Rule boosts:"));
  console.log(`  Texas: +${texas.boost.toFixed(2)}  - ${texas.reason}`);
  console.log(`  Remote: +${remote.boost.toFixed(2)} - ${remote.reason}`);
  console.log(`  ERP: +${erp.boost.toFixed(2)}    - ${erp.reason}`);
  console.log(`  Budget: +${budget.boost.toFixed(2)} - ${budget.reason}`);

  console.log("");
  console.log(chalk.green("Final pursue score:"), finalScore.toFixed(3));

  // Optional: output as JSON blob for programmatic use
  const markdownReport = `# Solicitation pursue score\n\n- ID: ${solId}\n- Title: ${
    target.title || "(untitled)"
  }\n- Location: ${target.location || "—"}\n- Type: ${
    target.cnType || "—"
  }\n- Keywords: ${
    Array.isArray(target.keywords) && target.keywords.length
      ? target.keywords.slice(0, 12).join(", ")
      : "—"
  } \n\n## Scores\n- Final score: ${(finalScore * 100).toFixed(
    1
  )}%\n- LLM score: ${(llm.llmScore * 100).toFixed(1)}%\n  - Rationale: ${
    llm.rationale || "(none)"
  }\n\n## Rule boosts\n- Texas: +${texas.boost.toFixed(2)} — ${
    texas.reason
  }\n- Remote: +${remote.boost.toFixed(2)} — ${
    remote.reason
  }\n- ERP: +${erp.boost.toFixed(2)} — ${
    erp.reason
  }\n- Budget: +${budget.boost.toFixed(2)} — ${budget.reason}\n`;

  const output = {
    solId,
    finalScore,
    llm,
    boosts: {
      texas,
      remote,
      erp,
      budget: {
        boost: budget.boost,
        reason: budget.reason,
        value: detectedBudget,
      },
    },
    markdown: markdownReport,
  };
  console.log("");
  console.log(chalk.gray("JSON output:"));
  console.log(JSON.stringify(output, null, 2));

  await solModel.patch({
    id: solId,
    data: {
      aiPursueScore: finalScore,
      aiPursueScoreNote: markdownReport,
    },
    baseUrl: BASE_URL,
    token: SERVICE_KEY,
  });
  console.log(`Updated solicitation ${solId} with AI pursue score.`);
}

main().catch((err) => {
  console.error(chalk.red("Error scoring solicitation:"), err?.message);
  if (err?.stack) console.error(chalk.red(err.stack));
  process.exit(1);
});
