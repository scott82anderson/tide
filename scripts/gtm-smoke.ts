/**
 * pnpm gtm:smoke [--base http://localhost:3000] [--shots dir]
 * Walks the go-to-market storyline in a headless browser against a running dev
 * server: console, target list, Scout, Researcher, Sequencer, review and send,
 * the free Try-It tool, the Desk, metrics. Model-backed agents need a key; the
 * script reports a blocked run as a warning and keeps going.
 */
import "./env";
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}
const BASE = arg("base", "http://localhost:3000");
const SHOTS = arg("shots", path.join("smoke-shots", "gtm"));
fs.mkdirSync(SHOTS, { recursive: true });
let step = 0;
async function shot(page: Page, name: string) {
  step++;
  const file = path.join(SHOTS, `${String(step).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  shot ${file}`);
}
const log = (m: string) => console.log(`> ${m}`);

/** Click a run button, wait for its toast, return the toast text. */
async function runAndWait(page: Page, label: RegExp, timeout = 120_000): Promise<string> {
  await page.getByRole("button", { name: label }).first().click();
  const toast = page.locator("[data-sonner-toast]").last();
  await toast.waitFor({ timeout });
  const text = (await toast.innerText()).trim();
  console.log(`  toast: ${text.split("\n")[0]}`);
  return text;
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.error("  page error:", e.message));

  log("1. Console");
  await page.goto(`${BASE}/gtm`);
  await page.getByText("Go-to-market console").waitFor();
  await shot(page, "console");

  log("2. Ranked target list");
  await page.goto(`${BASE}/gtm/accounts`);
  await page.getByText("Accounts").first().waitFor();
  await shot(page, "accounts");

  log("3. Account: Bayhaven, run the Scout (deterministic)");
  await page.goto(`${BASE}/gtm/accounts/acc_bayhaven`);
  await page.getByText("Revenue Left on the Dock").first().waitFor();
  await shot(page, "account-bayhaven");
  await runAndWait(page, /^Run Scout$/);
  await page.waitForURL(/\/gtm\/queue\/[a-z0-9]+$/i, { timeout: 20_000 });
  await shot(page, "queue-scout-report");

  log("4. Approve the Scout report as the Head of Sales");
  await page.getByRole("button", { name: /^Approve$/ }).click();
  await page.getByText(/Marked approved/).waitFor({ timeout: 15_000 });
  await shot(page, "queue-scout-approved");

  log("5. Researcher (cheap model) and Sequencer (strong model)");
  await page.goto(`${BASE}/gtm/accounts/acc_bayhaven`);
  const r = await runAndWait(page, /^Run Researcher$/);
  if (/on the review queue/.test(r)) {
    await page.waitForURL(/\/gtm\/queue\//, { timeout: 20_000 });
    await shot(page, "queue-research");
    await page.getByRole("button", { name: /^Approve$/ }).click();
    await page.getByText(/Marked approved/).waitFor({ timeout: 15_000 });
    await page.goto(`${BASE}/gtm/accounts/acc_bayhaven`);
  } else {
    console.warn("  Researcher did not run (no key?), continuing");
  }
  const s = await runAndWait(page, /^Draft sequence$/, 180_000);
  if (/on the review queue/.test(s)) {
    await page.waitForURL(/\/gtm\/queue\//, { timeout: 20_000 });
    await page.getByText(/Touch 1/).waitFor();
    await shot(page, "queue-sequence");

    log("6. Human send rule: send button disabled until approved, then send touch 1");
    const send = page.getByRole("button", { name: /^Send email$/ }).first();
    if (await send.isDisabled()) console.log("  send disabled before approval: ok");
    else console.warn("  send button was enabled before approval");
    await page.getByRole("button", { name: /^Approve$/ }).click();
    await page.getByText(/Marked approved/).waitFor({ timeout: 15_000 });
    await page.getByRole("button", { name: /^Send email$/ }).first().click();
    await page.getByText(/logged as sent/).waitFor({ timeout: 15_000 });
    await shot(page, "queue-sequence-sent");
  } else {
    console.warn("  Sequencer did not run (no key?), continuing");
  }

  log("7. Free tool: paste a note, draft, leave details");
  await page.goto(`${BASE}/try`);
  await page.getByRole("button", { name: /use the sample note|use the sea ray note/i }).first().click();
  await page.getByRole("button", { name: /draft the estimate/i }).click();
  await page.getByText(/See it against your own codes/).waitFor({ timeout: 120_000 });
  await shot(page, "try-draft");
  await page.getByLabel("Your name").fill("Pat Doyle");
  await page.getByLabel("Work email").fill("pat@doylesmarine.example");
  const yard = page.getByLabel("Yard");
  if (!(await yard.inputValue())) await yard.fill("Doyle's Marine");
  await page.getByRole("button", { name: /send me the accuracy/i }).click();
  await page.getByText(/We will be in touch/).waitFor({ timeout: 120_000 });
  await shot(page, "try-lead");

  log("8. Desk: coach the sample call");
  await page.goto(`${BASE}/gtm/desk`);
  await page.getByRole("button", { name: /use the sample call/i }).click();
  const c = await runAndWait(page, /coach this call/i, 120_000);
  if (/on the review queue/.test(c)) {
    await page.getByRole("link", { name: /open it/i }).click();
    await page.getByText(/Call notes/).first().waitFor();
    await shot(page, "queue-call-notes");
  }

  log("9. Metrics and roster");
  await page.goto(`${BASE}/gtm/metrics`);
  await page.getByText("Weekly metrics").waitFor();
  await shot(page, "metrics");
  await page.goto(`${BASE}/gtm/agents`);
  await page.getByText("Agent roster").waitFor();
  await shot(page, "agents");

  await browser.close();
  log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
