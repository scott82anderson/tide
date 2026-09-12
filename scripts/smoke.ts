/**
 * pnpm smoke [--base http://localhost:3000] [--shots dir]
 * Walks the demo storyline (spec Section 3) in a headless browser and saves
 * screenshots. Requires a running dev server against a seeded database.
 * Works without an API key: sample note 1 drafts from recorded output.
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
const SHOTS = arg("shots", path.join("smoke-shots"));
fs.mkdirSync(SHOTS, { recursive: true });

let step = 0;
async function shot(page: Page, name: string) {
  step++;
  const file = path.join(SHOTS, `${String(step).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  shot ${file}`);
}

function log(msg: string) {
  console.log(`> ${msg}`);
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.error("  page error:", e.message));

  log("1. Dashboard");
  await page.goto(`${BASE}/`);
  await page.getByText("Service desk").waitFor();
  await shot(page, "dashboard");

  log("2. Intake: sample note 1");
  await page.goto(`${BASE}/jobs/new`);
  await page.getByRole("button", { name: /use this note/i }).first().click();
  const textarea = page.locator("textarea").first();
  await textarea.locator("xpath=.").waitFor();
  await page.waitForFunction(() => {
    const t = document.querySelector("textarea");
    return t && t.value.includes("4471");
  });
  await shot(page, "intake-loaded");

  log("4. Draft estimate");
  await page.getByRole("button", { name: /draft estimate/i }).click();
  await page.waitForURL(/\/jobs\/(?!new)[a-z0-9]+$/i, { timeout: 90_000 });
  const reviewUrl = page.url();
  await page.getByText(/Reel Therapy/).first().waitFor();
  await shot(page, "review-draft");

  log("5. Edit hours 3.5 -> 3.0, approve");
  const hoursInput = page.locator('input[type="number"][value="3.5"]').first();
  if (await hoursInput.count()) {
    await hoursInput.fill("3");
    await page.getByRole("button", { name: /save changes/i }).click();
    await page.getByText(/saved|updated/i).first().waitFor({ timeout: 10_000 }).catch(() => {});
  } else {
    console.warn("  no 3.5 h input found, skipping edit");
  }
  await page.getByRole("button", { name: /approve draft/i }).click();
  await page.getByText(/awaiting customer/i).first().waitFor({ timeout: 15_000 });
  await shot(page, "review-approved");

  log("6. Send for eSign, portal, sign");
  const [popup] = await Promise.all([
    context.waitForEvent("page", { timeout: 15_000 }).catch(() => null),
    page.getByRole("button", { name: /send for esign/i }).click(),
  ]);
  const portal = popup ?? (await context.newPage());
  if (!popup) {
    const id = reviewUrl.split("/").pop();
    await portal.goto(`${BASE}/portal/estimates/${id}`);
  }
  await portal.getByText(/Approve & sign|Approve &amp; sign/i).first().waitFor({ timeout: 15_000 });
  await shot(portal, "portal");
  await portal.getByRole("textbox").first().fill("Dana Patterson");
  await portal.getByRole("checkbox").first().click();
  await portal.getByRole("button", { name: /approve & sign/i }).click();
  await portal.getByText(/WO-2026/).first().waitFor({ timeout: 20_000 });
  await shot(portal, "portal-signed");

  log("7. Dashboard scheduler shows the work order with a suggested slot");
  await page.goto(`${BASE}/`);
  await page.getByText(/WO-2026/).first().waitFor({ timeout: 15_000 });
  await shot(page, "dashboard-after-sign");
  const accept = page.getByRole("button", { name: /^accept$/i }).first();
  if (await accept.count()) {
    await accept.click();
    await page.waitForTimeout(1500);
    await shot(page, "dashboard-slot-accepted");
  }

  const dialogResult = page.getByRole("dialog").getByRole("button", { name: /send sms|send email|retry/i }).first();

  log("8. Due for service: draft outreach");
  await page.getByRole("button", { name: /draft outreach/i }).first().click();
  await dialogResult.waitFor({ timeout: 90_000 });
  await shot(page, "outreach-dialog");
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 5_000 });

  log("9. Overdue invoices: payment reminder");
  await page.getByRole("button", { name: /send payment reminder/i }).first().click();
  await dialogResult.waitFor({ timeout: 90_000 });
  await shot(page, "reminder-dialog");
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 5_000 });

  log("10. Eval page");
  await page.goto(`${BASE}/eval`);
  await page.getByText(/Golden set evaluation/).waitFor();
  await shot(page, "eval");

  await browser.close();
  log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
