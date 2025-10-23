/// <reference types="node" />
import "dotenv/config";
import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod/v3";
import fs from "fs";
import path from "path";
import { solicitation as solModel } from "@/app/models";
import { scrapingSites } from "@/app/config";
import type { Page, Frame } from "playwright";

// Early help guard to avoid running network logic when only help is requested
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printUsage();
  process.exit(0);
}

function parseSolIdFromArgs(argv: string[]): string | undefined {
  const kv = argv.find((a) => ["--id="].some((p) => a.startsWith(p)));
  if (kv) return kv.split("=", 2)[1];

  // Support split args: --solId ID, --id ID, --sol-id ID
  for (const key of ["--id"]) {
    const i = argv.indexOf(key);
    if (i >= 0 && i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
      return argv[i + 1];
    }
  }

  // Support positional first arg: extractDetails.ts <ID>
  const positionals = argv.filter((a) => !a.startsWith("--"));
  if (positionals.length > 0) return positionals[0];

  return undefined;
}

function parseUrlFromArgs(argv: string[]): string | undefined {
  // Support --url=VALUE and --url VALUE
  const kv = argv.find((a) => ["--url="].some((p) => a.startsWith(p)));
  if (kv) return kv.split("=", 2)[1];
  const i = argv.indexOf("--url");
  if (i >= 0 && i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
    return argv[i + 1];
  }
  return undefined;
}

function printUsage(): void {
  const script = "scripts/browserbasehq/extractDetails.ts";
  console.log(
    [
      `Usage: pnpm exec tsx ${script} --solId <SOLICITATION_ID>`,
      "",
      "Options:",
      "  --id                       Specify the solicitation ID",
      "  --url <URL>                Override the solicitation siteUrl to navigate",
      "  -h, --help                 Show this help and exit",
      "",
      "Also supported:",
      `  pnpm exec tsx ${script} <SOLICITATION_ID>`,
      "  Env var SOL_ID can be used when flags/positionals are not provided.",
    ].join("\n")
  );
}

// Heuristic checks for common security verification/anti-bot interstitials
async function looksLikeSecurityGate(page: Page): Promise<boolean> {
  try {
    // Fast iframe-based signals
    const challengeIframes = page.frames().filter((f) => {
      const url = f.url();
      return (
        url.includes("challenges.cloudflare.com") ||
        url.includes("hcaptcha.com") ||
        url.includes("/recaptcha/") ||
        url.includes("google.com/recaptcha")
      );
    });
    if (challengeIframes.length > 0) return true;

    // Text-based signals on the main document
    const textSignals = await page.evaluate(() => {
      const bodyText = document.body?.innerText?.toLowerCase() || "";
      const signals = [
        "security verification",
        "verify you are human",
        "are you human",
        "checking your browser before accessing",
        "just a moment",
        "unusual traffic",
        "press and hold",
        "complete a security check",
        "hcaptcha",
        "recaptcha",
        "turnstile",
      ];
      return signals.some((s) => bodyText.includes(s));
    });
    if (textSignals) return true;
  } catch {
    // ignore and assume not a gate
  }
  return false;
}

async function clickIfVisible(page: Page, selector: string): Promise<boolean> {
  try {
    const el = await page.$(selector);
    if (el) {
      await el.click({ delay: 50 });
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

async function attemptSolveRecaptcha(page: Page): Promise<boolean> {
  try {
    const recaptchaFrame = page
      .frames()
      .find(
        (f) =>
          f.url().includes("/recaptcha/") ||
          f.url().includes("google.com/recaptcha")
      );
    if (!recaptchaFrame) return false;
    // Try to click the checkbox if present (not always solvable automatically)
    const checkbox = await recaptchaFrame.$("#recaptcha-anchor");
    if (checkbox) {
      await checkbox.click({ delay: 50 });
      return true;
    }
  } catch {}
  return false;
}

async function attemptSolveHcaptcha(page: Page): Promise<boolean> {
  try {
    const hFrames = page
      .frames()
      .filter((f) => f.url().includes("hcaptcha.com"));
    for (const f of hFrames) {
      // Try to click the checkbox if present
      const checkbox = await f.$(
        'input[type="checkbox"], div[role="checkbox"]'
      );
      if (checkbox) {
        await checkbox.click({ delay: 50 });
        return true;
      }
    }
  } catch {}
  return false;
}

async function attemptSolveTurnstile(page: Page): Promise<boolean> {
  try {
    const tFrames = page
      .frames()
      .filter(
        (f) =>
          f.url().includes("challenges.cloudflare.com") ||
          f.url().includes("turnstile")
      );
    for (const f of tFrames) {
      // Some pages show a simple "Verify you are human" button
      const btn = await f.$('button:has-text("Verify")');
      if (btn) {
        await btn.click({ delay: 50 });
        return true;
      }
      // Fallback: try any primary/submit buttons
      const anyBtn = await f.$('button, input[type="submit"]');
      if (anyBtn) {
        await anyBtn.click({ delay: 50 });
        return true;
      }
    }
  } catch {}
  return false;
}

async function debugDump(page: Page, label: string) {
  const dir = path.resolve(process.cwd(), "scripts/browserbasehq/.debug");
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {}
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const base = path.join(dir, `${ts}_${label}`);
  try {
    await page.screenshot({ path: `${base}.png`, fullPage: true });
  } catch {}
  try {
    const html = await page.content();
    fs.writeFileSync(`${base}.html`, html, "utf8");
  } catch {}
}

async function maybeHandleSecurity(
  page: Page,
  totalTimeoutMs = 60000
): Promise<boolean> {
  const start = Date.now();
  // Give auto-resolving challenges a chance
  try {
    await page.waitForLoadState("domcontentloaded", { timeout: 15000 });
  } catch {}

  if (!(await looksLikeSecurityGate(page))) return false;

  console.log(
    "[security] Detected possible security verification. Attempting to resolve…"
  );
  await debugDump(page, "security_detected");

  // Try a small sequence of mitigation steps while within time budget
  while (Date.now() - start < totalTimeoutMs) {
    let acted = false;

    // 1) Try clicking obvious verify buttons on the main page
    acted =
      (await clickIfVisible(page, 'button:has-text("Verify")')) ||
      (await clickIfVisible(page, 'button:has-text("verify")')) ||
      (await clickIfVisible(page, 'input[type="submit"][value*="Verify" i]')) ||
      (await clickIfVisible(page, "text=Verify you are human")) ||
      acted;

    // 2) Try challenge-specific tactics in iframes
    acted = (await attemptSolveTurnstile(page)) || acted;
    acted = (await attemptSolveHcaptcha(page)) || acted;
    acted = (await attemptSolveRecaptcha(page)) || acted;

    // 3) Nudge the page (scroll/reload) to let auto challenge complete
    try {
      await page.evaluate(() => {
        window.scrollBy(0, 200);
        setTimeout(() => window.scrollTo({ top: 0 }), 50);
      });
    } catch {}

    // Wait briefly and see if gate is gone
    try {
      await page.waitForTimeout(1500);
    } catch {}

    const stillGated = await looksLikeSecurityGate(page);
    if (!stillGated) {
      console.log("[security] Gate appears cleared.");
      return true;
    }

    // As a periodic step, try a soft reload to reattempt the challenge
    if (Date.now() - start > totalTimeoutMs / 2) {
      try {
        console.log("[security] Trying a soft reload to reattempt challenge…");
        await page.reload({ waitUntil: "domcontentloaded" });
      } catch {}
    }
  }

  console.warn("[security] Unable to clear security gate within time budget.");
  await debugDump(page, "security_blocked");
  return false;
}

function normalizeEnvKey(site: string): string {
  return site.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

// Utilities to detect if extracted JSON looks like a login page/content
function stringHasLoginIndicators(str: string): boolean {
  const s = str.toLowerCase();
  return (
    s.includes("login") ||
    s.includes("log in") ||
    s.includes("sign in") ||
    s.includes("signin")
  );
}

function jsonContainsLogin(value: unknown, depth = 0): boolean {
  if (depth > 4) return false; // guard against deep/cyclic structures
  if (value == null) return false;
  const t = typeof value;
  if (t === "string") return stringHasLoginIndicators(value as string);
  if (Array.isArray(value))
    return value.some((v) => jsonContainsLogin(v, depth + 1));
  if (t === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      if (jsonContainsLogin(v, depth + 1)) return true;
    }
  }
  return false;
}

// Try to detect whether we are on a login page and sign in using heuristics
async function ensureLoggedIn(options: {
  page: Page;
  user?: string;
  pass?: string;
  tryLimit?: number;
  afterLoginUrl?: string;
  waitForPasswordMs?: number;
}): Promise<boolean> {
  const {
    page,
    user,
    pass,
    tryLimit = 2,
    afterLoginUrl,
    waitForPasswordMs = 0,
  } = options;
  if (!user || !pass) return false;

  async function hasPasswordField(): Promise<boolean> {
    try {
      const el = await page.$('input[type="password"]');
      return !!el;
    } catch {
      return false;
    }
  }

  async function maybeClickSignInEntrypoint(): Promise<void> {
    try {
      // Handle cookie/consent banners that may block inputs
      await clickIfVisible(page, 'button:has-text("Accept")');
      await clickIfVisible(page, 'button:has-text("I Agree")');
      await clickIfVisible(page, 'button:has-text("Got it")');
      const clicked =
        (await clickIfVisible(page, 'a:has-text("Sign in")')) ||
        (await clickIfVisible(page, 'a:has-text("Log in")')) ||
        (await clickIfVisible(page, 'button:has-text("Sign in")')) ||
        (await clickIfVisible(page, 'button:has-text("Log in")'));
      if (clicked) {
        try {
          await page.waitForLoadState("domcontentloaded", { timeout: 8000 });
        } catch {}
      }
    } catch {}
  }

  async function fillCredentialsAndSubmit(): Promise<boolean> {
    try {
      if (waitForPasswordMs > 0) {
        try {
          await page.waitForSelector('input[type="password"]', {
            timeout: waitForPasswordMs,
          });
        } catch {}
      }

      const userSelectors = [
        'input[type="email"]',
        'input[name*="email" i]',
        'input[id*="email" i]',
        'input[name*="username" i]',
        'input[id*="username" i]',
        'input[name*="user" i]',
        'input[id*="user" i]',
        'input[name*="login" i]',
        'input[id*="login" i]',
      ];
      const passSelectors = [
        'input[type="password"]',
        'input[name*="pass" i]',
        'input[id*="pass" i]',
      ];

      let passEl = null as any;
      for (const sel of passSelectors) {
        passEl = await page.$(sel);
        if (passEl) break;
      }
      if (!passEl) return false;

      let formHandle: any = null;
      try {
        formHandle = await passEl.evaluateHandle((e: HTMLInputElement) =>
          e.closest("form")
        );
      } catch {}

      const $within = async (selector: string) => {
        if (formHandle) {
          try {
            const el = await formHandle.asElement()?.$(selector);
            if (el) return el;
          } catch {}
        }
        return page.$(selector);
      };

      let userEl = null as any;
      for (const sel of userSelectors) {
        userEl = await $within(sel);
        if (userEl) break;
      }

      if (userEl) {
        try {
          await userEl.fill("");
        } catch {}
        await userEl.type(user, { delay: 20 });
      }

      try {
        await passEl.fill("");
      } catch {}
      await passEl.type(pass, { delay: 20 });

      const submitWithin = async (): Promise<boolean> => {
        if (formHandle) {
          try {
            const btn = await formHandle
              .asElement()
              ?.$('button[type="submit"], input[type="submit"]');
            if (btn) {
              await btn.click({ delay: 30 });
              return true;
            }
          } catch {}
        }
        return false;
      };

      const submitted =
        (await submitWithin()) ||
        (await clickIfVisible(page, 'button[type="submit"]')) ||
        (await clickIfVisible(page, 'input[type="submit"]')) ||
        (await clickIfVisible(page, 'button:has-text("Sign in")')) ||
        (await clickIfVisible(page, 'button:has-text("Log in")')) ||
        (await clickIfVisible(page, "text=/^sign in$/i")) ||
        (await clickIfVisible(page, "text=/^log in$/i"));

      if (!submitted) {
        try {
          await passEl.press("Enter");
        } catch {}
      }

      try {
        await page.waitForLoadState("networkidle", { timeout: 10000 });
      } catch {}

      const stillHasPassword = await hasPasswordField();
      if (!stillHasPassword) return true;

      try {
        const userMenu = await page.$(
          "text=/logout|sign out|my account|profile/i"
        );
        if (userMenu) return true;
      } catch {}

      return false;
    } catch {
      return false;
    }
  }

  for (let i = 0; i < tryLimit; i++) {
    console.log(`[auth] Attempt ${i + 1}/${tryLimit}: checking/login page…`);
    await maybeClickSignInEntrypoint();
    const onLogin = await hasPasswordField();
    if (!onLogin) {
      console.log(
        "[auth] No password field detected; assuming already authenticated."
      );
      return true;
    }
    const ok = await fillCredentialsAndSubmit();
    if (ok) {
      console.log(
        "[auth] Credentials submitted; verifying and navigating to target page…"
      );
      if (afterLoginUrl) {
        try {
          await page.goto(afterLoginUrl, { waitUntil: "domcontentloaded" });
          try {
            await page.waitForLoadState("networkidle", { timeout: 8000 });
          } catch {}
        } catch {}
      }
      return true;
    }
  }
  return false;
}

async function main() {
  const SOL_ID = parseSolIdFromArgs(process.argv.slice(2));

  if (!SOL_ID) {
    printUsage();
    throw new Error(
      "Missing SOL_ID. Provide via --solId, positional arg, or SOL_ID env var."
    );
  }

  const sol = await solModel.getById({
    baseUrl: process.env.BASE_URL!,
    id: SOL_ID,
    token: process.env.SERVICE_KEY!,
  });

  const siteConfig = scrapingSites[sol.site];

  if (!sol?.siteUrl) {
    throw new Error("Solicitation missing siteUrl");
  }

  const overrideUrl = parseUrlFromArgs(process.argv.slice(2));
  const targetUrl = overrideUrl || sol.siteUrl;

  const instruction = [
    "Extract this page into the specified RFP schema.",
    "Return ONLY the JSON that matches the schema—no additional keys like html, page_text, content, or raw text.",
    "If a field is not present on the page, return null for that field.",
    "Use ISO 8601 dates when possible (YYYY-MM-DD).",
    "Summarize description to 1-3 sentences, plain text only (no HTML).",
    "Use the current page URL for websiteUrl if applicable.",
  ];

  // Do not include credentials in the LLM instruction; we handle login via Playwright

  console.log(
    `Starting extraction for solicitation ${SOL_ID} ${targetUrl}` +
      (overrideUrl ? " (overridden via --url)" : "")
  );

  const stagehand = new Stagehand({
    env: "LOCAL",
    apiKey: process.env.BROWSERBASE_KEY!,
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
    verbose: 1,
    debugDir: path.resolve(process.cwd(), ".debug"),
  });

  await stagehand.init();
  const page = stagehand.page;

  await page.goto(targetUrl, {
    waitUntil: "domcontentloaded",
  });
  // If this site requires login, attempt to authenticate with provided env credentials
  if (siteConfig?.hasLogin) {
    const key = normalizeEnvKey(sol.site);
    const user = process.env[`${key}_USER`];
    const pass = process.env[`${key}_PASS`];
    if (!user || !pass) {
      console.warn(
        `[auth] ${sol.site} marked hasLogin=true but missing credentials in env: ${key}_USER/${key}_PASS`
      );
    } else {
      try {
        const waitForPasswordMs = /\/login\b/i.test(page.url()) ? 8000 : 0;
        const loggedIn = await ensureLoggedIn({
          page: page as unknown as Page,
          user,
          pass,
          tryLimit: 3,
          afterLoginUrl: targetUrl,
          waitForPasswordMs,
        });
        if (!loggedIn) {
          console.warn("[auth] Login attempt did not appear to succeed.");
        }
      } catch (e) {
        console.warn("[auth] Login attempt errored:", e);
      }
    }
  }
  // Handle potential security verification interstitials
  // await maybeHandleSecurity(page as unknown as Page, 60000);

  // Define schemas: loose (tolerates null title) for initial fetch to avoid server-side schema errors;
  // strict (requires title) for final validation once past any security gate.
  const rfpLooseSchema = z.object({
    title: z.string().nullable().optional(),
    solicitationNumber: z.string().nullable().optional(),
    agency: z.string().nullable().optional(),
    buyer: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    location: z
      .object({
        city: z.string().nullable().optional(),
        state: z.string().nullable().optional(),
        country: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
    publishedDate: z.string().nullable().optional(), // ISO 8601 if parseable
    dueDate: z.string().nullable().optional(), // ISO 8601 if parseable
    description: z.string().nullable().optional(), // 1-3 sentence summary
    contact: z
      .object({
        name: z.string().nullable().optional(),
        email: z.string().nullable().optional(),
        phone: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
    submission: z
      .object({
        url: z.string().nullable().optional(),
        instructions: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
    attachments: z
      .array(
        z.object({
          name: z.string().nullable().optional(),
          url: z.string(),
        })
      )
      .nullable()
      .optional(),
    budget: z
      .object({
        min: z.number().nullable().optional(),
        max: z.number().nullable().optional(),
        currency: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
    preBidMeeting: z
      .object({
        date: z.string().nullable().optional(), // ISO 8601 if parseable
        location: z.string().nullable().optional(),
        mandatory: z.boolean().nullable().optional(),
      })
      .nullable()
      .optional(),
    questionsDueDate: z.string().nullable().optional(), // ISO 8601 if parseable
    websiteUrl: z.string().nullable().optional(),
  });
  const rfpStrictSchema = rfpLooseSchema.extend({
    title: z.string().min(1, "title required"),
  });

  type LooseRfp = z.infer<typeof rfpLooseSchema>;
  type StrictRfp = z.infer<typeof rfpStrictSchema>;
  async function extractWithLoose(): Promise<
    { ok: true; data: LooseRfp } | { ok: false; error: unknown }
  > {
    try {
      const result = (await page.extract({
        instruction: instruction.join(" "),
        schema: rfpLooseSchema,
      })) as unknown as LooseRfp;
      return { ok: true, data: result };
    } catch (err) {
      return { ok: false, error: err };
    }
  }

  // First attempt: if schema validation fails due to security gate, mitigate and retry once
  let attempt = await extractWithLoose();
  if (!attempt.ok) {
    console.warn(
      "[extract] Initial extraction failed. Attempting to clear possible security gate and retry…"
    );
    const cleared = await maybeHandleSecurity(page as unknown as Page, 60000);
    if (cleared) {
      try {
        await page.waitForLoadState("networkidle", { timeout: 10000 });
      } catch {}
    }
    attempt = await extractWithLoose();
    if (!attempt.ok) {
      console.warn(
        "[extract] Extraction failed after retry. Dumping debug artifacts."
      );
      await debugDump(page as unknown as Page, "extract_failed");
      throw attempt.error;
    }
  }

  let rfpLoose = attempt.data;

  // If the returned content still looks like a security page, try once more
  const looksBlocked =
    !rfpLoose.title &&
    ((rfpLoose.description || "")
      .toLowerCase()
      .includes("security verification") ||
      (await looksLikeSecurityGate(page as unknown as Page)));

  if (looksBlocked) {
    console.warn(
      "[security] Content still appears gated. Retrying after another mitigation…"
    );
    const cleared = await maybeHandleSecurity(page as unknown as Page, 60000);
    if (cleared) {
      try {
        await page.waitForLoadState("networkidle", { timeout: 10000 });
      } catch {}
      // Re-extract with strict schema now that we (hopefully) passed the gate
      const strict = (await page.extract({
        instruction: instruction.join(" "),
        schema: rfpStrictSchema,
      })) as unknown as StrictRfp;
      rfpLoose = strict;
    } else {
      console.warn(
        "[security] Could not bypass verification automatically. Dumping debug artifacts."
      );
      await debugDump(page as unknown as Page, "extract_blocked");
    }
  }

  // If we are not gated anymore but title is still missing, attempt a strict extract once
  if (!rfpLoose.title) {
    try {
      const strict = (await page.extract({
        instruction: instruction.join(" "),
        schema: rfpStrictSchema,
      })) as unknown as StrictRfp;
      rfpLoose = strict;
    } catch {}
  }

  let rfp = rfpLoose as StrictRfp | LooseRfp;

  // If extracted data appears to be a login page (e.g., strings contain "login"),
  // return an empty JSON and skip DB updates to avoid storing gated content.
  if (jsonContainsLogin(rfp)) {
    console.warn(
      "[extract] Detected login-related content in extracted data. Returning empty JSON and skipping update."
    );
    await stagehand.close();
    console.log({});
    return;
  }

  // Ensure websiteUrl is the actual current URL if extractor returned a bare domain
  const currentUrl = page.url();
  if (!rfp.websiteUrl || !/^https?:\/\//i.test(rfp.websiteUrl)) {
    rfp.websiteUrl = currentUrl;
  }

  const updateData: Record<string, any> = {
    aiExtracted: true,
    siteData: { ...sol.siteData, ...rfp },
  };
  if (!sol.description && rfp.description)
    updateData.description = rfp.description;
  await solModel.patch({
    baseUrl: process.env.BASE_URL!,
    token: process.env.SERVICE_KEY!,
    id: SOL_ID,
    data: updateData,
  });
  console.log(`Solicitation ${SOL_ID} updated`);
  console.log(rfp);

  await stagehand.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
