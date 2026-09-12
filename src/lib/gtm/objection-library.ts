/**
 * The objection library the Objection Coach chooses from. The model may only
 * cite ids from this list; a new objection comes back as "none" and is routed
 * to Voice of Customer.
 */

export interface Objection {
  id: string;
  objection: string;
  response: string;
  proofPoint: string;
}

export const OBJECTIONS: Objection[] = [
  {
    id: "voice_to_text_junk",
    objection: "We tried voice-to-text before and it was junk.",
    response:
      "This does not transcribe and hand you text. It reads the note, matches the boat from your own vessel list and picks operation codes from your own catalogue, then prices from your standards and kits. The transcript is the input, the estimate is the output.",
    proofPoint: "On the 15-case golden set the vessel match was 15 of 15 and operation recall 0.96.",
  },
  {
    id: "techs_wont_use_it",
    objection: "Our technicians will not use another app.",
    response:
      "They already record notes and photos in DockMaster Mobile. Nothing changes on the dock. The Service Writer works from what they already capture, and the service writer or manager is the one who sees the draft.",
    proofPoint: "No new technician workflow: the input is the existing Mobile voice note.",
  },
  {
    id: "wrong_codes",
    objection: "The AI will pick the wrong codes and we will send bad estimates.",
    response:
      "It can only choose from a shortlist of your codes, and every line shows a confidence badge and the technician's words that drove it. Low-confidence lines are unchecked by default. A manager approves before anything reaches the owner.",
    proofPoint: "Shortlist-only matching; a code outside the shortlist is rejected and becomes an unmapped line.",
  },
  {
    id: "desktop_migration",
    objection: "We are on Desktop and do not want to migrate to Web right now.",
    response:
      "The Service Writer needs Web and Mobile because that is where the notes, photos and eSign live. The migration is the same one the team has planned; this gives it a payback. We can sequence it around your season.",
    proofPoint: "Every tier requires DockMaster Web and Mobile; migration lift is a Phase 1 target.",
  },
  {
    id: "data_used_against_us",
    objection: "You are using our data to sell to us.",
    response:
      "We only compute the report for accounts that opt in, and the report is yours whether or not you buy. Every figure links back to the query that produced it, so you can check it against your own reports.",
    proofPoint: "Consent-first: the Scout runs only on accounts with a recorded opt-in.",
  },
  {
    id: "too_expensive",
    objection: "It is too expensive for what it does.",
    response:
      "The price is sized against one recovered billable hour per technician per week. Your own numbers show how many standard hours went unbilled last season. If the tool recovers less than one hour a week per tech, we have priced it wrong.",
    proofPoint: "Pricing anchor: one recovered hour per tech per week at the yard's labour rate.",
  },
  {
    id: "already_on_molo",
    objection: "We already use Molo and it looks modern.",
    response:
      "Molo runs slips and billing well. It does not hold your operation codes, labour standards and forty years of work orders, so it has nothing to draft from. The Service Writer is only as good as the catalogue behind it.",
    proofPoint: "Drafting depends on operation codes, standards, kits and history in the system of record.",
  },
  {
    id: "customers_wont_esign",
    objection: "Our customers will not sign estimates on their phone.",
    response:
      "The owner page is plain language with photos and no codes, and it is the same eSign flow DockMaster Web already uses. Owners who prefer a call still get one; the estimate is ready either way.",
    proofPoint: "Owner portal: plain-language lines, photos, typed-name signature.",
  },
  {
    id: "tried_chatbots",
    objection: "We tried an AI chatbot and nobody used it.",
    response:
      "This is not a chat window. It is a step inside the workflow you already run: note in, draft estimate out, manager approves. There is nothing to type at.",
    proofPoint: "Workflow tool, not a chatbot: the model only selects from lists the system returns.",
  },
  {
    id: "bad_timing_season",
    objection: "We are in the middle of haul-out, ask again in the spring.",
    response:
      "Understood. The Onboarding Agent cleans your codes before go-live, so the work happens in the shoulder month, not during the crunch. Let us pick a date after haul-out and have day one be a real job.",
    proofPoint: "Onboarding cleans and maps codes before day one; pushes are aligned to shoulder months.",
  },
  {
    id: "capterra_reviews",
    objection: "Your Capterra reviews are mediocre.",
    response:
      "Fair. The reviews are about Desktop and support wait times, and both are being worked. Ask two of our design partners how the Service Writer beta has gone; we will connect you today.",
    proofPoint: "Design-partner references available on request; review programme underway.",
  },
];

export const OBJECTION_BY_ID = new Map(OBJECTIONS.map((o) => [o.id, o]));
