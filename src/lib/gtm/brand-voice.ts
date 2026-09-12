/**
 * One style guide for everything an agent drafts. Injected into every drafting
 * prompt and enforced again by style-lint.ts before a human sees the draft.
 */

export const ONE_LINER = "Turn every technician note into approved, billable work.";

export const BRAND_VOICE = `House style for DockMaster.

Plain, direct, no hype. Short sentences. Lead with the account's own numbers when you have them, and use them exactly as given: never round, scale or invent a figure. The product is the Service Writer: a technician records a voice note about a boat, and the Service Writer drafts an estimate from the yard's own operation codes, labour standards, parts and vessel history. The service manager reviews and approves. Nothing goes to a customer without a human click.

Positioning: DockMaster runs the yard (Dockwa and marketplaces fill slips). Molo and MarinaOffice look modern but do not hold the yard's operation codes and work order history. AI newcomers are a chatbot on nothing; this is an agent connected to the system of record.

Rules: no exclamation marks. No em dashes or en dashes. No superlatives (revolutionary, game-changing, cutting-edge, best-in-class, seamless). No urgency tricks (limited time, act now, don't miss). No "AI-powered" as a benefit. Do not promise outcomes; say what the software does. Sign with the sender's real name and title.`;

export const HYPE_WORDS = [
  "revolutionary",
  "game-changing",
  "game changing",
  "cutting-edge",
  "cutting edge",
  "best-in-class",
  "best in class",
  "seamless",
  "supercharge",
  "unlock",
  "synergy",
  "next-level",
  "next level",
  "limited time",
  "act now",
  "don't miss",
  "ai-powered",
  "world-class",
  "disrupt",
];

export const OPT_OUT_LINE = "If you would rather not hear from us about the Service Writer, reply with the word unsubscribe and we will stop.";
