import { z } from "zod";

// ---------- Step 2: extraction ----------

export const VesselHintsSchema = z.object({
  hinSuffix: z
    .string()
    .nullable()
    .describe("Last characters of the hull identification number if spoken, digits or letters only"),
  boatName: z.string().nullable().describe("Boat name if spoken"),
  makeModel: z.string().nullable().describe("Make and model as spoken, e.g. 'Sea Ray 400 Sundancer'"),
  slip: z.string().nullable().describe("Slip or rack location as spoken, e.g. 'C-12'"),
  ownerLastName: z.string().nullable().describe("Owner surname if spoken"),
});

export const FindingSchema = z.object({
  system: z
    .enum([
      "engine",
      "drive",
      "electrical",
      "plumbing",
      "hull",
      "canvas",
      "rigging",
      "haul",
      "detailing",
      "winterisation",
      "commissioning",
      "hydraulics",
      "other",
    ])
    .describe("Boat system the finding belongs to"),
  symptom: z.string().describe("What the customer or technician noticed, short"),
  observation: z.string().describe("What the technician found on inspection, short"),
  severity: z.enum(["low", "medium", "high"]),
  technicianRecommendation: z
    .string()
    .describe("The repair the technician recommends, in the technician's words"),
  estimatedHours: z
    .number()
    .nullable()
    .describe(
      "Hours the technician quoted for THIS finding. If one time covers several findings, attach it to the primary finding only and leave the others null.",
    ),
  engine: z
    .enum(["port", "starboard", "both", "single", "unspecified"])
    .describe("Which engine is affected, for multi-engine boats"),
  quoteSeparately: z
    .boolean()
    .describe("True when the technician says this should be quoted or estimated separately"),
});

export const ExtractionSchema = z.object({
  vesselHints: VesselHintsSchema,
  findings: z.array(FindingSchema),
  photosMentioned: z.array(z.string()).describe("Photos the technician refers to, as described"),
  rawSummary: z.string().describe("One or two sentence plain summary of the note"),
});
export type Extraction = z.infer<typeof ExtractionSchema>;
export type Finding = z.infer<typeof FindingSchema>;

// ---------- Step 3: vessel ranking fallback ----------

export const VesselRankSchema = z.object({
  vesselId: z.string().nullable().describe("Chosen vessel id from the candidate list, or null if none fits"),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string()).describe("Short reasons, each referencing a concrete hint"),
});
export type VesselRank = z.infer<typeof VesselRankSchema>;

// ---------- Step 4: operation matching ----------

export const OperationChoiceSchema = z.object({
  findingIndex: z.number().int().min(0),
  code: z
    .string()
    .nullable()
    .describe("Operation code chosen from the shortlist for this finding, or null when nothing fits"),
  confidence: z.number().min(0).max(1),
  rationale: z.string().describe("One line: why this code, quoting the technician's words"),
  unmappedDescription: z
    .string()
    .nullable()
    .describe("When code is null, a short description for an unmapped line the manager can price"),
});

export const OperationMatchSchema = z.object({
  choices: z.array(OperationChoiceSchema),
});
export type OperationMatch = z.infer<typeof OperationMatchSchema>;
export type OperationChoice = z.infer<typeof OperationChoiceSchema>;

// ---------- Step 6: narrative ----------

export const NarrativeSchema = z.object({
  lines: z.array(
    z.object({
      lineKey: z.string(),
      customerDescription: z
        .string()
        .describe("Plain language for the boat owner, two sentences max, no jargon, no upsell"),
    }),
  ),
  customerSummary: z.string().describe("Two or three sentences for the boat owner about the whole estimate"),
  internalSummary: z.string().describe("Short internal tech note summary for the work order, can use jargon"),
});
export type Narrative = z.infer<typeof NarrativeSchema>;

// ---------- Outreach ----------

export const OutreachSchema = z.object({
  sms: z.string().max(300).describe("SMS under 300 characters, warm and direct"),
  emailSubject: z.string(),
  emailBody: z.string().describe("Email body under 120 words, warm and direct, no pressure"),
});
export type Outreach = z.infer<typeof OutreachSchema>;

// ---------- Reminders ----------

export const ReminderSchema = z.object({
  subject: z.string(),
  body: z
    .string()
    .describe("Email body. Must include the literal placeholder {{PAYMENT_LINK}} exactly once."),
  sms: z.string().max(300).describe("SMS version under 300 chars, must include {{PAYMENT_LINK}}"),
});
export type Reminder = z.infer<typeof ReminderSchema>;
