/**
 * Go-to-market seed: the CRM as it would look 90 days into the plan. Twelve
 * design partners (the live Harbourline yard among them), a few install-base
 * accounts that have not consented yet, five new logos on other platforms and
 * a PE-backed group. Scout reports are computed by the real agent code so the
 * numbers on the console are the numbers the agent would produce.
 */

import type { PrismaClient } from "@prisma/client";
import { PrismaDockMasterClient } from "../../src/lib/dockmaster/mock-client";
import { scoutAccount, type ScoutReport } from "../../src/lib/gtm/agents/opportunity-scout";
import { OPT_OUT_LINE } from "../../src/lib/gtm/brand-voice";
import type { Account } from "../../src/lib/gtm/types";
import { d, json } from "./helpers";

type Row = Omit<Account, "createdAt" | "updatedAt" | "consentGrantedAt" | "contextFile"> & { consentGrantedAt?: string };

const zeroData = {
  standardHoursTtm: 0, billedHoursTtm: 0, estimatesTtm: 0, estimatesOver3Days: 0, avgEstimateValue: 0,
  vesselsPastInterval: 0, avgIntervalJobValue: 0, arOver45: 0, arTotal: 0, dsoDays: 0, slipCount: 0, vesselCount: 0, laborRate: 0,
};

function acct(partial: Partial<Row> & Pick<Row, "id" | "name" | "city" | "state" | "segment" | "platform">): Row {
  return {
    products: [], groupName: null, source: "seed", stage: "target", tier: null, ownerName: null, ownerRole: null,
    designPartner: false, dataConsent: false, smsOptIn: false, emailOptOut: false, conferenceAttendees: [], contacts: [],
    vesselMix: [], technicianCount: 0, ...zeroData, ...partial,
  };
}

const WM = ["web", "mobile"] as const;

export const accounts: Row[] = [
  // ---- design partners, consented ------------------------------------------
  acct({
    id: "acc_harbourline", name: "Harbourline Marine & Yacht Yard", city: "Stuart", state: "FL", segment: "install_base", platform: "dockmaster_web_mobile",
    products: [...WM, "valpay", "scheduling"], designPartner: true, dataConsent: true, consentGrantedAt: "2026-06-18", smsOptIn: true, stage: "live", tier: "service_writer",
    ownerName: "Rachel Nguyen", ownerRole: "CSM", vesselMix: ["sterndrive", "outboard", "inboard", "sail"], technicianCount: 5, slipCount: 140, vesselCount: 30, laborRate: 165,
    estimatesTtm: 210, estimatesOver3Days: 38, avgEstimateValue: 1850, dsoDays: 41,
    conferenceAttendees: [{ name: "Lena Okafor", title: "Service Manager" }],
    contacts: [{ name: "Lena Okafor", title: "Service Manager", role: "champion", sourceSignalId: null }],
  }),
  acct({
    id: "acc_bayhaven", name: "Bayhaven Boatworks", city: "Annapolis", state: "MD", segment: "install_base", platform: "dockmaster_web_mobile",
    products: [...WM, "valpay"], designPartner: true, dataConsent: true, consentGrantedAt: "2026-06-22", stage: "live", tier: "service_writer",
    ownerName: "Rachel Nguyen", ownerRole: "CSM", vesselMix: ["sterndrive", "sail"], technicianCount: 8, slipCount: 260, vesselCount: 310, laborRate: 158,
    standardHoursTtm: 9800, billedHoursTtm: 7900, estimatesTtm: 340, estimatesOver3Days: 52, avgEstimateValue: 2100, vesselsPastInterval: 61, avgIntervalJobValue: 1400, arOver45: 84000, arTotal: 132000, dsoDays: 52,
    conferenceAttendees: [{ name: "Gail Bruno", title: "General Manager" }, { name: "Ray Tolliver", title: "Service Manager" }],
  }),
  acct({
    id: "acc_pelican_point", name: "Pelican Point Marina", city: "Fort Myers", state: "FL", segment: "install_base", platform: "dockmaster_web_mobile",
    products: [...WM], designPartner: true, dataConsent: true, consentGrantedAt: "2026-07-02", stage: "onboarding", tier: "service_writer",
    ownerName: "Devon Clarke", ownerRole: "CSM", vesselMix: ["outboard"], technicianCount: 6, slipCount: 180, vesselCount: 240, laborRate: 145,
    standardHoursTtm: 7100, billedHoursTtm: 6200, estimatesTtm: 260, estimatesOver3Days: 44, avgEstimateValue: 1250, vesselsPastInterval: 48, avgIntervalJobValue: 900, arOver45: 21000, arTotal: 39000, dsoDays: 44,
  }),
  acct({
    id: "acc_northstar", name: "North Star Yacht Services", city: "Traverse City", state: "MI", segment: "install_base", platform: "dockmaster_web_mobile",
    products: [...WM, "valpay", "scheduling", "blu"], designPartner: true, dataConsent: true, consentGrantedAt: "2026-06-20", smsOptIn: true, stage: "live", tier: "ai_service_desk",
    ownerName: "Devon Clarke", ownerRole: "CSM", vesselMix: ["inboard", "sail"], technicianCount: 7, slipCount: 220, vesselCount: 280, laborRate: 152,
    standardHoursTtm: 8600, billedHoursTtm: 7300, estimatesTtm: 300, estimatesOver3Days: 29, avgEstimateValue: 2400, vesselsPastInterval: 74, avgIntervalJobValue: 1650, arOver45: 61000, arTotal: 98000, dsoDays: 52,
    conferenceAttendees: [{ name: "Erin Vasko", title: "Owner" }],
    contacts: [{ name: "Erin Vasko", title: "Owner", role: "decision_maker", sourceSignalId: null }],
  }),
  acct({
    id: "acc_saltmarsh", name: "Saltmarsh Boat Yard", city: "Charleston", state: "SC", segment: "install_base", platform: "dockmaster_web",
    products: ["web"], designPartner: true, dataConsent: true, consentGrantedAt: "2026-07-15", stage: "sandbox",
    ownerName: "Jordan Ellis", ownerRole: "AE", vesselMix: ["sterndrive", "outboard"], technicianCount: 5, slipCount: 120, vesselCount: 150, laborRate: 148,
    standardHoursTtm: 5900, billedHoursTtm: 4700, estimatesTtm: 190, estimatesOver3Days: 41, avgEstimateValue: 1500, vesselsPastInterval: 33, avgIntervalJobValue: 1100, arOver45: 17000, arTotal: 28000, dsoDays: 39,
  }),
  acct({
    id: "acc_gulfstream", name: "Gulfstream Marine Center", city: "Sarasota", state: "FL", segment: "install_base", platform: "dockmaster_web_mobile",
    products: [...WM], designPartner: true, dataConsent: true, consentGrantedAt: "2026-07-08", stage: "call",
    ownerName: "Jordan Ellis", ownerRole: "AE", vesselMix: ["outboard", "sterndrive"], technicianCount: 9, slipCount: 300, vesselCount: 360, laborRate: 160,
    standardHoursTtm: 11200, billedHoursTtm: 9100, estimatesTtm: 420, estimatesOver3Days: 66, avgEstimateValue: 1700, vesselsPastInterval: 88, avgIntervalJobValue: 1200, arOver45: 46000, arTotal: 71000, dsoDays: 47,
    conferenceAttendees: [{ name: "Marco Pellegrini", title: "Service Director" }],
  }),
  acct({
    id: "acc_kettle_cove", name: "Kettle Cove Marina", city: "Portland", state: "ME", segment: "install_base", platform: "dockmaster_desktop",
    products: [], designPartner: true, dataConsent: true, consentGrantedAt: "2026-07-20", stage: "contacted",
    ownerName: "Jordan Ellis", ownerRole: "AE", vesselMix: ["sail", "inboard"], technicianCount: 4, slipCount: 90, vesselCount: 110, laborRate: 138,
    standardHoursTtm: 4300, billedHoursTtm: 3500, estimatesTtm: 140, estimatesOver3Days: 35, avgEstimateValue: 1900, vesselsPastInterval: 27, avgIntervalJobValue: 1500, arOver45: 12000, arTotal: 19000, dsoDays: 43,
  }),
  acct({
    id: "acc_lakeshore", name: "Lakeshore Marine", city: "Chicago", state: "IL", segment: "install_base", platform: "dockmaster_web_mobile",
    products: [...WM, "valpay"], designPartner: true, dataConsent: true, consentGrantedAt: "2026-06-30", stage: "proposal",
    ownerName: "Jordan Ellis", ownerRole: "AE", vesselMix: ["sterndrive"], technicianCount: 6, slipCount: 200, vesselCount: 230, laborRate: 162,
    standardHoursTtm: 6800, billedHoursTtm: 5400, estimatesTtm: 240, estimatesOver3Days: 47, avgEstimateValue: 1600, vesselsPastInterval: 52, avgIntervalJobValue: 1300, arOver45: 38000, arTotal: 55000, dsoDays: 49,
    contacts: [{ name: "Tomasz Wrona", title: "General Manager", role: "decision_maker", sourceSignalId: null }],
  }),
  acct({
    id: "acc_bh_hilton_head", name: "Blue Harbor Hilton Head", city: "Hilton Head", state: "SC", segment: "group", platform: "dockmaster_web_mobile", groupName: "Blue Harbor Marine Group",
    products: [...WM], designPartner: true, dataConsent: true, consentGrantedAt: "2026-07-25", stage: "target",
    ownerName: "Jordan Ellis", ownerRole: "AE", vesselMix: ["outboard", "sterndrive"], technicianCount: 7, slipCount: 240, vesselCount: 290, laborRate: 155,
    standardHoursTtm: 8200, billedHoursTtm: 6600, estimatesTtm: 310, estimatesOver3Days: 58, avgEstimateValue: 1500, vesselsPastInterval: 64, avgIntervalJobValue: 1150, arOver45: 33000, arTotal: 54000, dsoDays: 48,
  }),
  acct({
    id: "acc_bh_savannah", name: "Blue Harbor Savannah", city: "Savannah", state: "GA", segment: "group", platform: "dockmaster_web_mobile", groupName: "Blue Harbor Marine Group",
    products: [...WM], designPartner: true, dataConsent: true, consentGrantedAt: "2026-07-25", stage: "target",
    ownerName: "Jordan Ellis", ownerRole: "AE", vesselMix: ["outboard"], technicianCount: 5, slipCount: 160, vesselCount: 190, laborRate: 150,
    standardHoursTtm: 5600, billedHoursTtm: 4900, estimatesTtm: 200, estimatesOver3Days: 22, avgEstimateValue: 1300, vesselsPastInterval: 36, avgIntervalJobValue: 1000, arOver45: 14000, arTotal: 26000, dsoDays: 40,
  }),
  acct({
    id: "acc_bh_jacksonville", name: "Blue Harbor Jacksonville", city: "Jacksonville", state: "FL", segment: "group", platform: "dockmaster_desktop", groupName: "Blue Harbor Marine Group",
    products: [], designPartner: true, dataConsent: true, consentGrantedAt: "2026-07-25", stage: "target",
    ownerName: "Jordan Ellis", ownerRole: "AE", vesselMix: ["outboard", "inboard"], technicianCount: 6, slipCount: 210, vesselCount: 250, laborRate: 152,
    standardHoursTtm: 7000, billedHoursTtm: 5300, estimatesTtm: 250, estimatesOver3Days: 71, avgEstimateValue: 1450, vesselsPastInterval: 59, avgIntervalJobValue: 1100, arOver45: 41000, arTotal: 63000, dsoDays: 55,
  }),
  acct({
    id: "acc_puget", name: "Puget Sound Boat Works", city: "Seattle", state: "WA", segment: "install_base", platform: "dockmaster_web_mobile",
    products: [...WM, "scheduling"], designPartner: true, dataConsent: true, consentGrantedAt: "2026-07-11", stage: "contacted",
    ownerName: "Rachel Nguyen", ownerRole: "CSM", vesselMix: ["inboard", "sail"], technicianCount: 10, slipCount: 320, vesselCount: 410, laborRate: 172,
    standardHoursTtm: 12600, billedHoursTtm: 10900, estimatesTtm: 460, estimatesOver3Days: 49, avgEstimateValue: 2600, vesselsPastInterval: 93, avgIntervalJobValue: 1900, arOver45: 52000, arTotal: 90000, dsoDays: 46,
    conferenceAttendees: [{ name: "Hana Kimura", title: "Service Manager" }, { name: "Dale Fenwick", title: "Owner" }],
  }),
  // ---- install base, no consent yet ----------------------------------------
  acct({
    id: "acc_cape_fear", name: "Cape Fear Yacht Yard", city: "Wilmington", state: "NC", segment: "install_base", platform: "dockmaster_desktop",
    products: [], stage: "target", ownerName: "Jordan Ellis", ownerRole: "AE", vesselMix: ["sail", "inboard"], technicianCount: 6, slipCount: 170, vesselCount: 200, laborRate: 150,
    conferenceAttendees: [{ name: "Beau Landry", title: "Service Manager" }],
  }),
  acct({
    id: "acc_lake_norman", name: "Lake Norman Marine", city: "Cornelius", state: "NC", segment: "install_base", platform: "dockmaster_web",
    products: ["web"], stage: "target", ownerName: "Rachel Nguyen", ownerRole: "CSM", vesselMix: ["sterndrive", "outboard"], technicianCount: 3, slipCount: 80, vesselCount: 95, laborRate: 140,
  }),
  acct({
    id: "acc_keys_marine", name: "Keys Marine Service", city: "Marathon", state: "FL", segment: "install_base", platform: "dockmaster_web_mobile",
    products: [...WM], stage: "target", ownerName: "Rachel Nguyen", ownerRole: "CSM", vesselMix: ["outboard"], technicianCount: 8, slipCount: 150, vesselCount: 260, laborRate: 158,
    conferenceAttendees: [{ name: "Carla Mendes", title: "Owner" }],
  }),
  // ---- new logos ------------------------------------------------------------
  acct({
    id: "acc_tidewater", name: "Tidewater Boat Repair", city: "Norfolk", state: "VA", segment: "new_logo", platform: "molo",
    stage: "target", ownerName: "Casey Morgan", ownerRole: "AE", vesselMix: ["outboard", "sterndrive"], technicianCount: 7, slipCount: 0, vesselCount: 220,
  }),
  acct({
    id: "acc_coastal_craft", name: "Coastal Craft Services", city: "Newport", state: "RI", segment: "new_logo", platform: "marinaoffice",
    stage: "sandbox", ownerName: "Casey Morgan", ownerRole: "AE", vesselMix: ["sail"], technicianCount: 5, vesselCount: 140,
  }),
  acct({
    id: "acc_riverbend", name: "Riverbend Marine", city: "Knoxville", state: "TN", segment: "new_logo", platform: "spreadsheets",
    stage: "target", ownerName: "Casey Morgan", ownerRole: "AE", vesselMix: ["sterndrive", "outboard"], technicianCount: 4, vesselCount: 120,
  }),
  acct({
    id: "acc_islander", name: "Islander Yacht Service", city: "San Diego", state: "CA", segment: "new_logo", platform: "molo",
    stage: "call", ownerName: "Casey Morgan", ownerRole: "AE", vesselMix: ["inboard", "sail"], technicianCount: 9, vesselCount: 330,
  }),
  acct({
    id: "acc_harbor_light", name: "Harbor Light Boatyard", city: "Bay City", state: "MI", segment: "new_logo", platform: "none", source: "try_it",
    stage: "sandbox", ownerName: "Casey Morgan", ownerRole: "AE", vesselMix: ["sterndrive"], technicianCount: 3, vesselCount: 70,
  }),
];

// ------------------------------------------------------------------ signals
interface SignalSeed { account: string; source: string; date: string; title: string; body: string; url?: string }
const s = (account: string, source: string, date: string, title: string, body: string, url?: string): SignalSeed => ({ account, source, date, title, body, url });

export const signals: SignalSeed[] = [
  s("acc_bayhaven", "linkedin", "2026-07-14", "Ray Tolliver started a new position", "Ray Tolliver is now Service Manager at Bayhaven Boatworks. Previously lead technician at a Chesapeake yard for nine years.", "https://linkedin.example/in/rtolliver"),
  s("acc_bayhaven", "google_reviews", "2026-08-02", "3 stars: 'good work, slow paperwork'", "The mechanics know their stuff and the repair was solid. But it took eight days to get a written quote and I had to call twice. Gail in the office was apologetic."),
  s("acc_bayhaven", "google_reviews", "2026-06-19", "2 stars: 'waited two weeks for an estimate'", "Dropped the boat in May, got the estimate mid June. By then the season was half gone. Work itself was fine."),
  s("acc_bayhaven", "website", "2026-05-01", "About us", "Family owned since 1981. 260 slips, full service yard, eight factory-trained technicians. Authorized Mercury and Volvo Penta dealer."),
  s("acc_bayhaven", "job_posting", "2026-08-20", "Hiring: Marine Technician", "Bayhaven Boatworks is hiring a marine technician. Sterndrive and diesel experience preferred. Busy yard, year-round work."),

  s("acc_northstar", "capterra", "2026-07-30", "4 stars review of DockMaster", "We run everything on DockMaster Web and Mobile. Scheduling assistant is useful. Wish estimates were faster to write up from the techs' notes. Erin Vasko, Owner."),
  s("acc_northstar", "news", "2026-08-11", "North Star adds winter storage building", "North Star Yacht Services has opened a 40,000 square foot heated storage building, adding capacity for 60 boats."),
  s("acc_northstar", "association", "2026-03-01", "AMI member directory", "North Star Yacht Services, Traverse City MI. Member since 2015. Certified Clean Marina."),

  s("acc_gulfstream", "google_reviews", "2026-07-22", "4 stars: 'great techs, quote took a while'", "Marco's team fixed an intermittent electrical fault two other shops missed. The only knock: waiting six days for the estimate before they could start."),
  s("acc_gulfstream", "linkedin", "2026-06-05", "Gulfstream Marine Center is hiring", "We are growing. Looking for two outboard technicians (Yamaha, Mercury) to join a team of nine.", "https://linkedin.example/company/gulfstream"),
  s("acc_gulfstream", "boat_show", "2026-02-15", "Miami International Boat Show exhibitor list", "Gulfstream Marine Center, booth 1412, Sarasota FL. Service and storage."),

  s("acc_lakeshore", "linkedin", "2026-07-01", "Tomasz Wrona promoted to General Manager", "Excited to share that I have been promoted to General Manager at Lakeshore Marine. Focus for the year: service department throughput.", "https://linkedin.example/in/twrona"),
  s("acc_lakeshore", "google_reviews", "2026-08-15", "5 stars", "Best yard on the lake. They text you photos of what they found. Estimates come through the portal and you sign on your phone."),

  s("acc_kettle_cove", "website", "2026-04-10", "Services page", "Kettle Cove Marina: full service yard for sail and power, four technicians, winter storage for 110 boats. Call the office for a quote."),
  s("acc_kettle_cove", "google_reviews", "2026-07-05", "3 stars: 'old school'", "Solid work on our diesel. Everything is on paper though. Took a week to get a price and it came as a photo of a handwritten sheet."),

  s("acc_puget", "linkedin", "2026-08-25", "Hana Kimura joined Puget Sound Boat Works", "Hana Kimura is now Service Manager at Puget Sound Boat Works, moving from a large dealership group.", "https://linkedin.example/in/hkimura"),
  s("acc_puget", "job_posting", "2026-08-01", "Hiring: Service Writer", "Puget Sound Boat Works seeks an experienced marine service writer to turn technician findings into customer estimates. Ten technicians, high volume."),

  s("acc_cape_fear", "google_reviews", "2026-08-09", "2 stars: 'three weeks for a quote'", "Nice people, but I waited three weeks for an estimate on a rigging job and ended up going elsewhere."),
  s("acc_cape_fear", "website", "2026-01-15", "Home", "Cape Fear Yacht Yard. Sail and power. Six technicians. 170 slips."),

  s("acc_keys_marine", "job_posting", "2026-08-28", "Hiring: Outboard Technician", "Keys Marine Service is hiring a Yamaha certified outboard technician. Eight-tech shop, year-round."),
  s("acc_keys_marine", "google_reviews", "2026-06-30", "4 stars", "Fast turnaround on a 300 hour service. Would like to see the estimate before the work next time."),

  s("acc_tidewater", "job_posting", "2026-08-18", "Hiring: Service Writer / Advisor", "Tidewater Boat Repair is hiring a service writer. You will translate technician notes into estimates and keep customers updated. Seven-technician shop."),
  s("acc_tidewater", "google_reviews", "2026-07-28", "3 stars: 'communication'", "Repairs are good. Getting a quote is the slow part; I waited nine days and had to chase. They said they were switching software."),
  s("acc_tidewater", "website", "2026-05-20", "Book service online", "Powered by Molo. Request service, view invoices."),
  s("acc_tidewater", "linkedin", "2026-06-12", "New service manager at Tidewater", "Welcome Deshawn Carter as Service Manager at Tidewater Boat Repair.", "https://linkedin.example/in/dcarter"),

  s("acc_coastal_craft", "website", "2026-03-30", "Services", "Coastal Craft Services, Newport RI. Rigging, sails, engine service for sailboats. Five technicians. Runs on MarinaOffice."),
  s("acc_coastal_craft", "google_reviews", "2026-08-05", "4 stars", "Great rigging work. Their quotes come as an email a few days after the inspection."),

  s("acc_riverbend", "google_reviews", "2026-07-19", "3 stars", "Family shop, four techs, honest. Everything by phone and spreadsheet; ask for the estimate in writing."),

  s("acc_islander", "linkedin", "2026-08-22", "Islander Yacht Service expands", "We have added a second haul-out well and two technicians, bringing the team to nine.", "https://linkedin.example/company/islander"),
  s("acc_islander", "google_reviews", "2026-08-30", "2 stars: 'slow estimates'", "Two weeks for a written estimate on a shaft seal. Work was fine once it started."),
  s("acc_islander", "website", "2026-04-01", "Customer portal", "Powered by Molo. View and pay invoices online."),

  s("acc_harbor_light", "website", "2026-02-01", "Home", "Harbor Light Boatyard, Bay City MI. Three technicians. Sterndrive specialists. Call for a quote."),
];

// ------------------------------------------------------------- account codes
export const pelicanCodes: { code: string; description: string; hours: number; usageCount: number }[] = [
  { code: "OIL CHG", description: "OIL CHG", hours: 1, usageCount: 88 },
  { code: "OIL-OB", description: "Oil change - outboard", hours: 1, usageCount: 61 },
  { code: "OILFILT", description: "Oil and filter change", hours: 1.2, usageCount: 14 },
  { code: "IMP", description: "IMPELLER", hours: 1.5, usageCount: 52 },
  { code: "WP-IMP", description: "Water pump impeller replace", hours: 1.5, usageCount: 37 },
  { code: "IMP-YAM", description: "Impeller replacement - Yamaha", hours: 1.5, usageCount: 9 },
  { code: "100HR", description: "100 HR SVC", hours: 3, usageCount: 120 },
  { code: "100-SVC", description: "100 hour service", hours: 3, usageCount: 41 },
  { code: "BTMPNT", description: "Bottom paint", hours: 6, usageCount: 70 },
  { code: "BP-HAUL", description: "BOTTOM PAINT - HAUL INCL", hours: 8, usageCount: 33 },
  { code: "HAUL", description: "Haul out", hours: 1, usageCount: 150 },
  { code: "H&L", description: "Haul & launch", hours: 2, usageCount: 95 },
  { code: "DETAIL", description: "Detail", hours: 4, usageCount: 48 },
  { code: "WASHWAX", description: "Wash & wax", hours: 4, usageCount: 22 },
  { code: "BATT", description: "Battery replace", hours: 0.8, usageCount: 30 },
  { code: "BATT-R", description: "Batt Repl", hours: 0.8, usageCount: 11 },
  { code: "PROP", description: "Prop change", hours: 0.5, usageCount: 44 },
  { code: "PROP-RR", description: "Propeller R&R", hours: 0.5, usageCount: 18 },
  { code: "STEER-BL", description: "Steering bleed", hours: 1, usageCount: 12 },
  { code: "FUELFLT", description: "Fuel filter", hours: 0.5, usageCount: 66 },
  { code: "FF-RACOR", description: "Fuel filter - Racor", hours: 0.5, usageCount: 20 },
  { code: "ELEC-DX", description: "Electrical diag", hours: 1.5, usageCount: 27 },
  { code: "WINTER", description: "Winterize", hours: 3, usageCount: 0 },
  { code: "TRLR-BRG", description: "Trailer bearings", hours: 1.5, usageCount: 15 },
];

// ---------------------------------------------------------------- telemetry
const WEEKS = ["2026-07-20", "2026-07-27", "2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31", "2026-09-07"];
type WeekTuple = [drafts: number, approved: number, edit: number, approval: number, valpay: number, arDays: number, techs: number];
export const telemetry: Record<string, WeekTuple[]> = {
  acc_harbourline: [
    [6, 4, 0.35, 0.7, 0, 41, 3], [8, 6, 0.33, 0.72, 0, 41, 3], [9, 7, 0.29, 0.75, 1200, 40, 4], [11, 8, 0.26, 0.78, 1800, 40, 4],
    [12, 10, 0.22, 0.8, 2400, 39, 5], [13, 11, 0.2, 0.8, 2900, 39, 5], [14, 12, 0.18, 0.82, 3200, 38, 5], [14, 12, 0.17, 0.83, 3400, 38, 5],
  ],
  acc_bayhaven: [
    [12, 8, 0.42, 0.66, 0, 52, 6], [13, 8, 0.41, 0.64, 0, 52, 6], [11, 7, 0.4, 0.65, 500, 53, 5], [10, 6, 0.38, 0.62, 400, 53, 5],
    [10, 6, 0.36, 0.63, 600, 54, 4], [9, 5, 0.33, 0.6, 300, 54, 4], [9, 5, 0.32, 0.61, 200, 55, 4], [8, 5, 0.31, 0.6, 200, 55, 4],
  ],
  acc_northstar: [
    [10, 7, 0.4, 0.7, 2100, 52, 5], [12, 9, 0.34, 0.74, 2600, 52, 6], [14, 11, 0.28, 0.77, 3300, 51, 6], [16, 13, 0.22, 0.8, 4100, 51, 7],
    [17, 14, 0.18, 0.82, 4800, 50, 7], [19, 16, 0.15, 0.84, 5600, 50, 7], [20, 17, 0.13, 0.85, 6200, 49, 7], [21, 18, 0.12, 0.86, 6900, 49, 7],
  ],
};

// ----------------------------------------------------------------- feedback
interface FeedbackSeed { account: string | null; source: string; date: string; text: string }
const f = (account: string | null, source: string, date: string, text: string): FeedbackSeed => ({ account, source, date, text });
export const feedback: FeedbackSeed[] = [
  f("acc_harbourline", "support_ticket", "2026-08-04", "The draft picked the pump replacement code when the tech said 'pump is weeping'. Correct, but the tech meant reseal. Can we teach it our shorthand?"),
  f("acc_harbourline", "support_ticket", "2026-08-21", "Photo attached to the note did not show on the owner's estimate page until refresh."),
  f("acc_bayhaven", "support_ticket", "2026-08-12", "Our managers keep editing hours down. The standards in our catalogue are from 2019 and too high. Is there a way to learn from the edits?"),
  f("acc_bayhaven", "call_transcript", "2026-07-30", "Ray: 'We tried voice-to-text three years ago and it was junk. What is different?'"),
  f("acc_bayhaven", "support_ticket", "2026-09-01", "Request: let the owner see the proposed date from the scheduler in the portal."),
  f("acc_northstar", "call_transcript", "2026-08-14", "Erin: 'AR is our real problem. If the reminders and ValPay link were automatic we would pay for that alone.'"),
  f("acc_northstar", "support_ticket", "2026-08-26", "Would like separate estimates per engine when the tech says port and starboard."),
  f("acc_pelican_point", "call_transcript", "2026-08-19", "'Half our codes are duplicates. Cleaning them is the part we dread.'"),
  f("acc_gulfstream", "call_transcript", "2026-09-03", "Marco: 'If the techs have to type anything it is dead on arrival. Voice only.'"),
  f("acc_gulfstream", "call_transcript", "2026-09-03", "Marco: 'Can it suggest a substitute part when the kit item is out of stock?'"),
  f("acc_kettle_cove", "call_transcript", "2026-08-27", "'We are on Desktop. Moving to Web in haul-out season is not happening.'"),
  f("acc_lakeshore", "call_transcript", "2026-09-05", "Tomasz: 'The proposal needs to show the migration cost next to the recovered hours or my owner will not sign.'"),
  f("acc_puget", "review", "2026-08-10", "Capterra: DockMaster Web is solid; support response times could be faster."),
  f("acc_tidewater", "call_transcript", "2026-09-08", "Deshawn: 'Molo looks nicer. What do you have that they do not?'"),
  f("acc_islander", "call_transcript", "2026-09-09", "'Our customers are older. They will not sign anything on a phone.'"),
  f(null, "dot_vote", "2026-09-01", "Roadmap dot-vote (pre-conference survey): parts substitution when out of stock, 14 votes."),
  f(null, "dot_vote", "2026-09-01", "Roadmap dot-vote (pre-conference survey): learn from manager edits per yard, 11 votes."),
  f(null, "dot_vote", "2026-09-01", "Roadmap dot-vote (pre-conference survey): Spanish language notes, 6 votes."),
  f(null, "review", "2026-07-15", "Capterra: 'Great for a full service yard, steep learning curve on Desktop.'"),
  f("acc_keys_marine", "support_ticket", "2026-08-30", "Can the estimate go by SMS instead of email? Our owners do not read email in season."),
];

// ------------------------------------------------------------------ partners
export const partners = [
  { id: "prt_mercury", name: "Mercury Marine", kind: "oem", focus: "Outboard and sterndrive OEM. Dealer service quality and parts order accuracy affect warranty cost and CSI scores.", contacts: [{ name: "Alison Grady", title: "Dealer Programs Manager" }], notes: "Runs a dealer CSI programme; slow estimates show up as low CSI." },
  { id: "prt_yamaha", name: "Yamaha Marine", kind: "oem", focus: "Outboard OEM. Certified technician network; interest in structured service records.", contacts: [{ name: "Ken Ishida", title: "Service Marketing" }], notes: "Co-markets with dealers at regional shows." },
  { id: "prt_landnsea", name: "Land 'N' Sea Distributing", kind: "distributor", focus: "Parts distributor to marine dealers. Wants accurate, early parts orders from estimates.", contacts: [{ name: "Rob Petrakis", title: "Dealer Development" }], notes: "Kit-level ordering from an approved estimate is the pitch." },
  { id: "prt_anchor_mutual", name: "Anchor Mutual Marine Insurance", kind: "insurer", focus: "Hull and machinery insurer. Documented, photographed work reduces claims friction.", contacts: [{ name: "Dana Whitcombe", title: "Claims Innovation" }], notes: "Interested in estimate plus photos as a claims artefact." },
  { id: "prt_harbor_capital", name: "Harbor Capital Partners", kind: "pe_operating_partner", focus: "Owns Blue Harbor Marine Group (three DockMaster sites). Operating partner wants standardised service KPIs across sites.", contacts: [{ name: "Vikram Anand", title: "Operating Partner" }], notes: "Buys top-down; wants a cross-site league table." },
  { id: "prt_ami", name: "Association of Marina Industries", kind: "association", focus: "Marina operators' association. Conference content, member webinars, certification.", contacts: [{ name: "Joan Meeker", title: "Education Director" }], notes: "Member webinar slot available in the shoulder season." },
];

// ------------------------------------------------------------ seed function
export async function seedGtm(prisma: PrismaClient) {
  await prisma.outboundMessage.deleteMany();
  await prisma.queueItem.deleteMany();
  await prisma.agentRun.deleteMany();
  await prisma.accountWeek.deleteMany();
  await prisma.accountCode.deleteMany();
  await prisma.accountSignal.deleteMany();
  await prisma.feedbackItem.deleteMany();
  await prisma.partner.deleteMany();
  await prisma.account.deleteMany();

  const created = d("2026-06-15");
  await prisma.account.createMany({
    data: accounts.map((a) => ({
      id: a.id, name: a.name, city: a.city, state: a.state, segment: a.segment, platform: a.platform, products: json(a.products), groupName: a.groupName,
      source: a.source, stage: a.stage, tier: a.tier, ownerName: a.ownerName, ownerRole: a.ownerRole, designPartner: a.designPartner,
      dataConsent: a.dataConsent, consentGrantedAt: a.consentGrantedAt ? d(a.consentGrantedAt) : null, smsOptIn: a.smsOptIn, emailOptOut: a.emailOptOut,
      conferenceAttendees: json(a.conferenceAttendees), contacts: json(a.contacts), vesselMix: json(a.vesselMix),
      technicianCount: a.technicianCount, slipCount: a.slipCount, vesselCount: a.vesselCount, laborRate: a.laborRate,
      standardHoursTtm: a.standardHoursTtm, billedHoursTtm: a.billedHoursTtm, estimatesTtm: a.estimatesTtm, estimatesOver3Days: a.estimatesOver3Days,
      avgEstimateValue: a.avgEstimateValue, vesselsPastInterval: a.vesselsPastInterval, avgIntervalJobValue: a.avgIntervalJobValue,
      arOver45: a.arOver45, arTotal: a.arTotal, dsoDays: a.dsoDays,
      contextFile: `# ${a.name}\n- Jun 15, 2026: imported from the CRM (${a.segment.replace("_", " ")}, ${a.platform.replace(/_/g, " ")}), owner ${a.ownerName ?? "unassigned"}${a.dataConsent ? `\n- ${a.consentGrantedAt}: data consent recorded for the Revenue Left on the Dock report` : ""}`,
      createdAt: created, updatedAt: created,
    })),
  });

  await prisma.accountSignal.createMany({
    data: signals.map((x, i) => ({ id: `sig_${String(i + 1).padStart(3, "0")}`, accountId: x.account, source: x.source, title: x.title, body: x.body, url: x.url ?? null, observedAt: d(x.date) })),
  });
  await prisma.accountCode.createMany({ data: pelicanCodes.map((c) => ({ accountId: "acc_pelican_point", ...c })) });
  await prisma.accountWeek.createMany({
    data: Object.entries(telemetry).flatMap(([accountId, weeks]) =>
      weeks.map((w, i) => ({ accountId, weekStart: d(WEEKS[i]), draftsStarted: w[0], draftsApproved: w[1], editRate: w[2], approvalRate: w[3], valpayVolume: w[4], arDays: w[5], activeTechs: w[6] })),
    ),
  });
  await prisma.feedbackItem.createMany({
    data: feedback.map((x, i) => ({ id: `fb_${String(i + 1).padStart(3, "0")}`, accountId: x.account, source: x.source, text: x.text, observedAt: d(x.date) })),
  });
  await prisma.partner.createMany({ data: partners.map((p) => ({ ...p, contacts: json(p.contacts) })) });

  // ---- history: the first 90 days of the plan, produced by the real agent code
  const dockmaster = new PrismaDockMasterClient(prisma);
  const rows = await prisma.account.findMany();
  const reports = new Map<string, ScoutReport>();
  let runDay = 0;
  for (const row of rows) {
    const account: Account = {
      ...row,
      segment: row.segment as Account["segment"], platform: row.platform as Account["platform"], products: JSON.parse(row.products), source: row.source as Account["source"],
      stage: row.stage as Account["stage"], tier: row.tier as Account["tier"], ownerRole: row.ownerRole as Account["ownerRole"],
      conferenceAttendees: JSON.parse(row.conferenceAttendees), contacts: JSON.parse(row.contacts), vesselMix: JSON.parse(row.vesselMix),
    };
    // Accounts sourced from the free tool have not been scored yet; everything else was scored in July.
    if (account.source === "try_it") continue;
    const report = await scoutAccount({ dockmaster }, account);
    reports.set(account.id, report);
    const when = d("2026-07-28", 14 + (runDay % 4));
    runDay++;
    const run = await prisma.agentRun.create({
      data: { agent: "opportunity_scout", accountId: account.id, status: "succeeded", input: json({ accountId: account.id }), output: json(report), sourceQueries: json(report.figures), modelTier: "none", latencyMs: 40 + runDay * 3, createdAt: when },
    });
    const approved = account.designPartner;
    await prisma.queueItem.create({
      data: {
        runId: run.id, agent: "opportunity_scout", kind: "scout_report", accountId: account.id,
        title: `Revenue Left on the Dock: ${account.name}`, output: json(report),
        sourceData: json({ dataSource: report.dataSource, consented: report.consented, figures: report.figures, notes: [], steps: [{ step: "compute_report", latencyMs: 40 }] }),
        approverRole: "Head of Sales", status: approved ? "approved" : "pending", reviewerName: approved ? "Priya Desai" : null, reviewedAt: approved ? d("2026-07-30") : null,
        reviewNote: approved ? "Validated against the finance extract with the CSM." : null, createdAt: when,
      },
    });
    await prisma.account.update({
      where: { id: account.id },
      data: { contextFile: `${row.contextFile}\n- Jul 28, 2026: Scout scored ${report.score}/100, $${report.totalAnnualUsd.toLocaleString("en-US")} a year recoverable (${report.confidence} confidence, ${report.dataSource})${approved ? "\n- Jul 30, 2026: Scout report approved by Priya Desai" : ""}` },
    });
  }

  // Approved research for three accounts (Researcher ran on the cheap model in August).
  const research: Record<string, unknown> = {
    acc_bayhaven: {
      research: {
        serviceDepartmentSize: "medium", estimatedTechnicians: 8, techStack: ["DockMaster Web", "DockMaster Mobile", "ValPay"],
        decisionMakers: [{ name: "Gail Bruno", title: "General Manager", role: "decision_maker", sourceSignalId: "sig_002" }, { name: "Ray Tolliver", title: "Service Manager", role: "champion", sourceSignalId: "sig_001" }],
        triggers: [
          { type: "new_manager", summary: "Ray Tolliver started as Service Manager in July", evidenceSignalId: "sig_001", strength: "strong" },
          { type: "slow_quotes", summary: "Two recent reviews mention eight days and two weeks to get a quote", evidenceSignalId: "sig_002", strength: "strong" },
          { type: "hiring_technicians", summary: "Hiring a sterndrive and diesel technician in August", evidenceSignalId: "sig_005", strength: "moderate" },
        ],
        summary: "Family yard with eight technicians and a new service manager who came up as a lead tech. Reviews praise the work and complain about quote turnaround, which is the Service Writer's pitch. Gail Bruno runs the office and signs.",
      },
      signalsRead: 5,
    },
    acc_tidewater: {
      research: {
        serviceDepartmentSize: "medium", estimatedTechnicians: 7, techStack: ["Molo"],
        decisionMakers: [{ name: "Deshawn Carter", title: "Service Manager", role: "champion", sourceSignalId: "sig_026" }],
        triggers: [
          { type: "hiring_technicians", summary: "Hiring a service writer to turn technician notes into estimates", evidenceSignalId: "sig_023", strength: "strong" },
          { type: "slow_quotes", summary: "Review cites nine days for a quote and a planned software switch", evidenceSignalId: "sig_024", strength: "strong" },
          { type: "new_manager", summary: "Deshawn Carter joined as Service Manager in June", evidenceSignalId: "sig_026", strength: "moderate" },
        ],
        summary: "Seven-technician shop on Molo that is hiring a human service writer for exactly the job the Service Writer does. A new service manager and a review that mentions switching software make this a live new-logo opportunity.",
      },
      signalsRead: 4,
    },
    acc_northstar: {
      research: {
        serviceDepartmentSize: "medium", estimatedTechnicians: 7, techStack: ["DockMaster Web", "DockMaster Mobile", "ValPay", "AI Scheduling", "Blu"],
        decisionMakers: [{ name: "Erin Vasko", title: "Owner", role: "decision_maker", sourceSignalId: "sig_006" }],
        triggers: [
          { type: "expansion", summary: "Opened a 40,000 square foot heated storage building for 60 boats", evidenceSignalId: "sig_007", strength: "strong" },
          { type: "slow_quotes", summary: "Owner's Capterra review asks for faster estimates from tech notes", evidenceSignalId: "sig_006", strength: "moderate" },
        ],
        summary: "Full DockMaster stack, owner-led, expanding storage capacity. The owner has publicly asked for faster estimate write-up from technician notes.",
      },
      signalsRead: 3,
    },
  };
  for (const [accountId, output] of Object.entries(research)) {
    const when = d("2026-08-05");
    const run = await prisma.agentRun.create({
      data: { agent: "account_researcher", accountId, status: "succeeded", input: json({ accountId }), output: json(output), model: "claude-haiku-4-5", modelTier: "cheap", latencyMs: 4200, createdAt: when },
    });
    await prisma.queueItem.create({
      data: { runId: run.id, agent: "account_researcher", kind: "research", accountId, title: `Research: ${accounts.find((a) => a.id === accountId)!.name}`, output: json(output), sourceData: json({ notes: [], steps: [{ step: "classify_signals", latencyMs: 4200, model: "claude-haiku-4-5" }] }), approverRole: "SDR", status: "approved", reviewerName: "Sam Whitlock", reviewedAt: d("2026-08-06"), createdAt: when },
    });
  }

  // Sequences approved and sent by a human for accounts that moved past "target".
  const sent: { accountId: string; sender: string; touches: number; replied: boolean; day: string }[] = [
    { accountId: "acc_saltmarsh", sender: "Jordan Ellis", touches: 2, replied: true, day: "2026-08-11" },
    { accountId: "acc_gulfstream", sender: "Jordan Ellis", touches: 3, replied: true, day: "2026-08-12" },
    { accountId: "acc_kettle_cove", sender: "Jordan Ellis", touches: 2, replied: false, day: "2026-08-18" },
    { accountId: "acc_lakeshore", sender: "Jordan Ellis", touches: 1, replied: true, day: "2026-08-04" },
    { accountId: "acc_puget", sender: "Rachel Nguyen", touches: 1, replied: false, day: "2026-09-01" },
    { accountId: "acc_islander", sender: "Casey Morgan", touches: 2, replied: true, day: "2026-08-25" },
  ];
  for (const x of sent) {
    const a = accounts.find((r) => r.id === x.accountId)!;
    const report = reports.get(x.accountId)!;
    const touches = [
      { day: 0, channel: "email", subject: `${a.name}: ${report.figures.find((q) => q.key === "unbilledHours")?.value ?? ""} unbilled hours last season`, goal: "Open the sandbox and paste a real tech note", body: `${report.pitchSentence}\n\nI have set up a sandbox seeded with your operation codes. Paste one real note from a technician and see the draft: /try?account=${a.id}\n\n${x.sender}\n\n${OPT_OUT_LINE}` },
      { day: 4, channel: "email", subject: "One more number", goal: "Book a 20 minute call", body: `Following up with one number: ${report.figures.find((q) => q.key === "vesselsPastInterval")?.value ?? 0} of your vessels are past a maintenance interval right now. The Service Writer drafts the outreach and the estimate; your team clicks send.\n\nTwenty minutes this week?\n\n${x.sender}\n\n${OPT_OUT_LINE}` },
      { day: 8, channel: "call", subject: null, goal: "Book the call", body: `Call script: reference the sandbox session, ask what the draft got right and wrong, offer to run their 20 real notes through the golden set.` },
    ];
    const output = { sender: { name: x.sender, title: "Account Executive" }, sandboxUrl: `/try?account=${a.id}`, tone: a.segment === "install_base" ? "Existing customer, CSM voice" : "New logo, brief and specific", touches: touches.map((t) => ({ ...t, lint: [] })), smsEligible: a.smsOptIn, figuresUsed: report.figures };
    const when = d(x.day, 9);
    const run = await prisma.agentRun.create({
      data: { agent: "sequencer", accountId: a.id, status: "succeeded", input: json({ accountId: a.id }), output: json(output), sourceQueries: json(report.figures), model: "claude-sonnet-4-6", modelTier: "strong", latencyMs: 9800, createdAt: when },
    });
    const item = await prisma.queueItem.create({
      data: { runId: run.id, agent: "sequencer", kind: "sequence", accountId: a.id, title: `Sequence: ${a.name} (3 touches)`, output: json(output), sourceData: json({ figures: report.figures, notes: [], steps: [] }), approverRole: "AE", status: "edited", reviewerName: x.sender, reviewedAt: d(x.day, 11), editedOutput: json(output), editRatio: 0.08 + (x.touches * 0.03), reviewNote: "Edited two lines in touch one.", createdAt: when },
    });
    for (let i = 0; i < x.touches; i++) {
      const t = touches[i];
      const sentAt = new Date(d(x.day, 12).getTime() + t.day * 86400000);
      const last = i === x.touches - 1;
      await prisma.outboundMessage.create({
        data: { accountId: a.id, queueItemId: item.id, touchIndex: i, channel: t.channel, subject: t.subject, body: t.body, approvedBy: x.sender, sentAt, status: x.replied && last ? "replied" : "sent", repliedAt: x.replied && last ? new Date(sentAt.getTime() + 30 * 3600000) : null },
      });
    }
    await prisma.account.update({ where: { id: a.id }, data: { contextFile: { set: `${(await prisma.account.findUniqueOrThrow({ where: { id: a.id } })).contextFile}\n- ${x.day}: ${x.sender} approved the sequence and sent touch 1${x.touches > 1 ? ` to ${x.touches}` : ""}${x.replied ? "; prospect replied" : ""}` } } });
  }

  // Three Try-It sessions from the free tool: one left details (Harbor Light), two anonymous.
  const tryIt = [
    { accountId: "acc_harbor_light", day: "2026-09-02", lead: { name: "Pete Ostrander", email: "pete@harborlightboatyard.example", yardName: "Harbor Light Boatyard", platform: "none" } },
    { accountId: null, day: "2026-09-06", lead: null },
    { accountId: null, day: "2026-09-10", lead: null },
  ];
  for (const t of tryIt) {
    const output = { transcript: "Hull number ending 4471, Sea Ray 400 Sundancer in slip C-12, Patterson. Port engine running hot at cruise. Impeller chewed up. Recommend replace impeller and the pump, flush the cooling system.", recorded: false, vessel: { name: "Reel Therapy", detail: "2019 Sea Ray 400 Sundancer, Slip C-12, Dana Patterson", confidence: 0.98, reasons: ["HIN ends in 4471", "Slip C-12 matches"] }, findings: 3, lines: [], total: 1934.6, separateDrafts: 0, latencyMs: 9400, accountId: t.accountId, accountName: t.accountId ? "Harbor Light Boatyard" : null, lead: t.lead, nextStep: "Send us 20 real notes and your rate card and we will show you your accuracy on your own codes." };
    const run = await prisma.agentRun.create({
      data: { agent: "try_it_concierge", accountId: t.accountId, status: "succeeded", input: json({ transcript: output.transcript, lead: t.lead }), output: json(output), model: "claude-sonnet-4-6", modelTier: "strong", latencyMs: 9400, createdAt: d(t.day, 15) },
    });
    if (t.lead) {
      await prisma.queueItem.create({
        data: { runId: run.id, agent: "try_it_concierge", kind: "try_it_lead", accountId: t.accountId, title: `Try-It lead: ${t.lead.yardName} (${t.lead.name})`, output: json(output), sourceData: json({ notes: [], steps: [] }), approverRole: "Marketing", status: "approved", reviewerName: "Miles Okoro", reviewedAt: d("2026-09-03"), reviewNote: "Call booked for Sep 16.", createdAt: d(t.day, 15) },
      });
      await prisma.account.update({ where: { id: t.accountId! }, data: { contextFile: `# Harbor Light Boatyard\n- Sep 2, 2026: created from a Try-It session by Pete Ostrander; drafted 3 lines in 9.4s\n- Sep 3, 2026: Miles Okoro booked a 20 minute call for Sep 16` } });
    }
  }
}
