/**
 * The knowledge base the Sales Engineer answers from: product docs, API docs,
 * security policy, consent policy, past RFP answers. The model may only cite
 * ids from this list, and a question the documents do not cover comes back as
 * needsHuman rather than an invented answer.
 */

export interface KnowledgeDoc {
  id: string;
  title: string;
  kind: "product" | "api" | "security" | "policy" | "rfp";
  body: string;
}

export const KNOWLEDGE: KnowledgeDoc[] = [
  {
    id: "doc_product_overview",
    title: "Service Writer product overview",
    kind: "product",
    body: "A technician records a voice note and photos in DockMaster Mobile. The Service Writer drafts an estimate from the yard's own operation codes, labour standards, parts catalogue and vessel history. The service manager reviews, edits and approves. The estimate goes to the boat owner for eSign, converts to a work order and lands on the scheduler with a suggested slot from the AI Scheduling Assistant. Two side panels reuse the same machinery: due-for-service outreach and overdue AR reminders with a ValPay link. Every AI output is a draft with a confidence indicator; nothing is sent to a customer without a human click.",
  },
  {
    id: "doc_guardrails",
    title: "Drafting guardrails",
    kind: "product",
    body: "Codes, hours, rates, parts, stock and history come from the database; the model selects and explains, it never prices. Vessel and operation choices are validated against the shortlist the model was shown; a code outside it is rejected and logged. Confidence badges: high 85 percent and up, medium 60 to 85, low under 60 (unchecked by default). Every line carries source ai until edited or approved, then source staff. Operation codes are scoped per technician role, mirroring Blu. Estimates over 5,000 dollars require manager approval. Every pipeline step and every staff and customer action is written to the activity log.",
  },
  {
    id: "doc_accuracy",
    title: "Golden set results",
    kind: "product",
    body: "A 15-case golden set of technician notes covers clear cases, ambiguous vessel hints, slang, multi-system notes, a note with nothing actionable and a vessel not in the system. Last run: vessel match 15 of 15, operation recall 0.96, operation precision 1.00, separate-estimate detection 15 of 15, mean latency 10.4 seconds for extraction through pricing. Targets: vessel match at least 14 of 15, operation recall at least 0.85. Per-yard golden sets are built from the yard's own closed work orders during onboarding.",
  },
  {
    id: "doc_api",
    title: "DockMaster Web 2.0 API integration",
    kind: "api",
    body: "The Service Writer reads and writes through a single DockMasterClient interface. Reads: vessels and history, operation codes (cached one hour), parts kits and stock, open invoices, schedule. Writes: estimates (create, update, send for signature, convert to work order), payment links via ValPay, activity log entries. Auth is an OAuth client-credentials token per tenant; tenant scoping is a header on every call. The Onboarding Agent is the only GTM agent with write access, limited to operation code updates after CSM approval. The Opportunity Scout is read-only.",
  },
  {
    id: "doc_security",
    title: "Security and data handling",
    kind: "security",
    body: "Model calls go to the Anthropic API over TLS. Prompts contain the technician note, photos and the shortlists returned by the DockMaster API for that tenant; they do not contain other tenants' data. Anthropic's commercial API does not train on customer data. Transcripts may contain customer names and are treated as PII: retained with the tech note in the tenant's database, redacted from application logs. Access control follows DockMaster roles. Audit: every AI step with input, output and latency is stored with the estimate. Production hardening items (rate limits, idempotent drafting, per-tenant cost tracking) are on the roadmap and not yet in the prototype.",
  },
  {
    id: "doc_consent",
    title: "Data consent policy for the Scout report",
    kind: "policy",
    body: "Using an account's own DockMaster data to build its Revenue Left on the Dock report requires a recorded opt-in from an authorised contact at the account, granted as part of the beta or at the user conference. Without consent the Scout uses public signals only and marks the report low confidence. Aggregate benchmarks across accounts are anonymised and never identify a yard. The report is provided to the account whether or not it buys.",
  },
  {
    id: "doc_packaging",
    title: "Packaging and pricing",
    kind: "product",
    body: "Four tiers, all requiring DockMaster Web and Mobile. Service Writer: drafting, history flags, eSign handoff, priced per location plus per active technician and sized against one recovered billable hour per technician per week. AI Service Desk: Service Writer plus AI Scheduling and Blu Voice at a bundle discount. Revenue Suite: AI Service Desk plus due-for-service outreach and an AR collections agent via ValPay, where ValPay margin subsidises the software price. Group: everything plus multi-site benchmarking for PE-backed roll-ups. Prices are assumptions until sized against Valsoft data.",
  },
  {
    id: "doc_transcription",
    title: "Transcription and offline capture",
    kind: "product",
    body: "Audio is transcribed server-side with Whisper when the note syncs from the offline-first Mobile app. If transcription is unavailable the note can be typed or pasted. The model reads the transcript and the attached photos; the extraction call already accepts images and a focused cross-check prompt is on the roadmap.",
  },
  {
    id: "doc_rfp_uptime",
    title: "Past RFP answer: availability and support",
    kind: "rfp",
    body: "DockMaster Web is hosted with a 99.9 percent monthly availability target and support hours of 8am to 8pm Eastern on business days with an after-hours line for outages. The Service Writer inherits this. If the model provider is unavailable, drafting fails with a visible error and a retry; nothing is sent, and the manual estimate path is unaffected.",
  },
];

export const KNOWLEDGE_BY_ID = new Map(KNOWLEDGE.map((d) => [d.id, d]));
