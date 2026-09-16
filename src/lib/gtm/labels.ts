import type { Platform, QueueKind, QueueStatus, Segment, Stage, Tier } from "./types";

export const STAGE_LABEL: Record<Stage, string> = {
  target: "Target",
  contacted: "Contacted",
  sandbox: "Sandbox",
  call: "Call booked",
  proposal: "Proposal",
  closed_won: "Closed won",
  closed_lost: "Closed lost",
  onboarding: "Onboarding",
  live: "Live",
};

export const STAGE_ORDER: Stage[] = ["target", "contacted", "sandbox", "call", "proposal", "closed_won", "onboarding", "live", "closed_lost"];

export const STAGE_TONE: Record<Stage, "neutral" | "ai" | "warning" | "success" | "destructive"> = {
  target: "neutral",
  contacted: "neutral",
  sandbox: "ai",
  call: "ai",
  proposal: "warning",
  closed_won: "success",
  onboarding: "success",
  live: "success",
  closed_lost: "destructive",
};

export const SEGMENT_LABEL: Record<Segment, string> = {
  install_base: "Install base",
  new_logo: "New logo",
  group: "Group",
};

export const PLATFORM_LABEL: Record<Platform, string> = {
  dockmaster_desktop: "DockMaster Desktop",
  dockmaster_web: "DockMaster Web",
  dockmaster_web_mobile: "DockMaster Web + Mobile",
  molo: "Molo",
  marinaoffice: "MarinaOffice",
  spreadsheets: "Spreadsheets",
  none: "No system",
};

export const TIER_LABEL: Record<Tier, string> = {
  service_writer: "Service Writer",
  ai_service_desk: "AI Service Desk",
  revenue_suite: "Revenue Suite",
  group: "Group",
};

export const KIND_LABEL: Record<QueueKind, string> = {
  scout_report: "Revenue Left on the Dock",
  research: "Account research",
  sequence: "Outreach sequence",
  sandbox: "Sandbox and walkthrough",
  try_it_lead: "Try-It lead",
  rfp_answer: "RFP and technical answers",
  proposal: "Proposal and ROI",
  call_notes: "Call notes",
  onboarding_plan: "Onboarding plan",
  health_report: "Account health",
  case_study: "Case study",
  voc_report: "Voice of Customer",
  conference_plan: "Conference plan",
  partner_brief: "Partner brief",
};

export const QUEUE_STATUS_LABEL: Record<QueueStatus, string> = {
  pending: "Awaiting review",
  approved: "Approved",
  edited: "Approved with edits",
  rejected: "Rejected",
};

export const TONE_CLASS = {
  ai: "border-ai/40 bg-ai-soft text-foreground",
  neutral: "border-border bg-muted text-foreground",
  warning: "border-warning/50 bg-warning-soft text-warning-foreground",
  success: "border-success/40 bg-success-soft text-foreground",
  destructive: "border-destructive/40 bg-destructive/10 text-destructive",
} as const;

export function usd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}
