/**
 * The small, senior team that owns the agents' output (GTM doc, section 9).
 * Agents draft; these people click.
 */

import type { ApproverRole } from "./types";

export interface TeamMember {
  name: string;
  title: string;
  role: ApproverRole;
}

export const TEAM: TeamMember[] = [
  { name: "Priya Desai", title: "GM, Service Writer", role: "Head of Sales" },
  { name: "Jordan Ellis", title: "Account Executive, install base", role: "AE" },
  { name: "Casey Morgan", title: "Account Executive, new logos", role: "AE" },
  { name: "Sam Whitlock", title: "SDR, runs the agents", role: "SDR" },
  { name: "Rachel Nguyen", title: "Customer Success Manager", role: "CSM" },
  { name: "Devon Clarke", title: "Customer Success Manager", role: "CSM" },
  { name: "Ana Sorensen", title: "Solutions Engineer", role: "Solutions lead" },
  { name: "Miles Okoro", title: "Product Marketing", role: "Marketing" },
  { name: "Nadia Iqbal", title: "Product Manager", role: "Product" },
  { name: "Tess Hartley", title: "Events", role: "Events lead" },
  { name: "Leo Baptiste", title: "Partnerships", role: "Partnerships lead" },
];

export function approversFor(role: ApproverRole): TeamMember[] {
  return TEAM.filter((t) => t.role === role);
}

export function memberByName(name: string): TeamMember | undefined {
  return TEAM.find((t) => t.name === name);
}
