/**
 * Recorded model outputs for sample note 1 (Sea Ray overheat). Shapes match the
 * zod schemas in lib/ai/schemas.ts so FakeStructuredCaller can validate them.
 */

export const NOTE_1_TRANSCRIPT =
  "Hull number ending 4471, that's the Sea Ray 400 Sundancer in slip C-12, Patterson. Port engine running hot at cruise, about 205. Impeller is chewed up, missing two vanes. Raw water pump is weeping at the seal. Recommend replace impeller and the pump, flush the cooling system, check the heat exchanger for vane debris. Call it three, maybe three and a half hours. Also the starboard trim tab actuator is leaking, we should quote that separately.";

export const extractionFixture = {
  vesselHints: {
    hinSuffix: "4471",
    boatName: null,
    makeModel: "Sea Ray 400 Sundancer",
    slip: "C-12",
    ownerLastName: "Patterson",
  },
  findings: [
    {
      system: "engine",
      symptom: "Port engine running hot at cruise, about 205",
      observation: "Impeller chewed up, missing two vanes",
      severity: "high",
      technicianRecommendation: "replace impeller",
      estimatedHours: null,
      engine: "port",
      quoteSeparately: false,
    },
    {
      system: "engine",
      symptom: "Raw water pump weeping at the seal",
      observation: "Seal leak on raw water pump",
      severity: "medium",
      technicianRecommendation: "replace the raw water pump",
      estimatedHours: 3.5,
      engine: "port",
      quoteSeparately: false,
    },
    {
      system: "engine",
      symptom: "Overheating after impeller failure",
      observation: "Possible vane debris in cooling circuit",
      severity: "medium",
      technicianRecommendation: "flush the cooling system",
      estimatedHours: null,
      engine: "port",
      quoteSeparately: false,
    },
    {
      system: "engine",
      symptom: "Overheating after impeller failure",
      observation: "Vane debris may have reached the heat exchanger",
      severity: "medium",
      technicianRecommendation: "check the heat exchanger for vane debris",
      estimatedHours: null,
      engine: "port",
      quoteSeparately: false,
    },
    {
      system: "hydraulics",
      symptom: "Starboard trim tab actuator leaking",
      observation: "Hydraulic leak at actuator",
      severity: "low",
      technicianRecommendation: "replace starboard trim tab actuator",
      estimatedHours: null,
      engine: "unspecified",
      quoteSeparately: true,
    },
  ],
  photosMentioned: [],
  rawSummary: "Port engine overheating from a failed impeller and weeping raw water pump; trim tab actuator leak to be quoted separately.",
};

export const operationMatchFixture = {
  choices: [
    { findingIndex: 0, code: "ENG-IMP-01", confidence: 0.96, rationale: '"replace impeller" maps directly', unmappedDescription: null },
    { findingIndex: 1, code: "ENG-RWP-01", confidence: 0.93, rationale: '"replace the pump" with seal weeping', unmappedDescription: null },
    { findingIndex: 2, code: "ENG-CLF-01", confidence: 0.9, rationale: '"flush the cooling system"', unmappedDescription: null },
    { findingIndex: 3, code: "ENG-HEX-01", confidence: 0.88, rationale: '"check the heat exchanger for vane debris" is an inspection', unmappedDescription: null },
    { findingIndex: 4, code: "HYD-TAB-01", confidence: 0.94, rationale: '"trim tab actuator is leaking"', unmappedDescription: null },
  ],
};

export const narrativeFixtureMain = {
  lines: [
    { lineKey: "f0", customerDescription: "The rubber impeller that pushes cooling water through your port engine has lost two of its vanes. We will fit a new one so the engine can cool properly." },
    { lineKey: "f1", customerDescription: "The pump that moves seawater through the engine is leaking at its seal. Replacing the pump stops the leak and prevents further overheating." },
    { lineKey: "f2", customerDescription: "We will flush the engine's cooling system to clear out any debris from the failed impeller." },
    { lineKey: "f3", customerDescription: "We will check the heat exchanger for pieces of the old impeller and clean it if needed." },
  ],
  customerSummary: "Your port engine has been running hot because its cooling water pump is failing. This estimate covers replacing the worn parts and cleaning out the cooling system.",
  internalSummary: "Port eng overheating at cruise (~205F). Impeller missing 2 vanes, RWP weeping at seal. Replace impeller + pump, flush cooling, inspect HEX for vane debris.",
};

export const narrativeFixtureSeparate = {
  lines: [
    { lineKey: "f4", customerDescription: "The starboard trim tab's hydraulic actuator is leaking. We will replace it so the tab holds its position." },
  ],
  customerSummary: "The starboard trim tab actuator is leaking and should be replaced. We have quoted it separately as your technician suggested.",
  internalSummary: "Stbd trim tab actuator leaking, replace. Quoted separately per tech.",
};
