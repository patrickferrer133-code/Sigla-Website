// docs/06 section 5: "auto-flagging on a maintained keyword and pattern list
// for restriction, self-harm, and harassment language, routed to human
// review, not auto-deleted" and "distress escalation... surfaces crisis
// support resources appropriate to the user's country and routes the report
// to a human reviewer immediately." This is a starting list, not exhaustive —
// keyword matching is a routing signal for a human moderator, never an
// auto-delete trigger and never the final word on what the post means.

const CRISIS_PATTERNS = [
  /\bkill myself\b/i,
  /\bsuicid/i,
  /\bend my life\b/i,
  /\bwant to die\b/i,
  /\bself[\s-]?harm\b/i,
  /\bhurting myself\b/i,
];

const RESTRICTION_PATTERNS = [
  /\b\d{2,4}\s*(kcal|calories?)\b/i,
  /\bgoal weight\b/i,
  /\bpurg(e|ing)\b/i,
  /\bstarv(e|ing)\b/i,
  /\blaxatives?\b/i,
];

const HARASSMENT_PATTERNS = [/\bkill yourself\b/i, /\bfat pig\b/i, /\bugly (fat|slob)\b/i];

export type FlagKind = "crisis" | "restriction" | "harassment";

export function detectFlags(text: string): FlagKind[] {
  const flags: FlagKind[] = [];
  if (CRISIS_PATTERNS.some((p) => p.test(text))) flags.push("crisis");
  if (RESTRICTION_PATTERNS.some((p) => p.test(text))) flags.push("restriction");
  if (HARASSMENT_PATTERNS.some((p) => p.test(text))) flags.push("harassment");
  return flags;
}

export interface CrisisResource {
  label: string;
  contact: string;
}

// PH-only per docs/02 open decisions. Public crisis lines, verified sources
// as of doc build time — re-verify before relying on this at launch.
const CRISIS_RESOURCES_PH: CrisisResource[] = [
  { label: "National Center for Mental Health Crisis Hotline (PH)", contact: "1553 (landline, toll-free) or 0917-899-8727" },
  { label: "Hopeline PH", contact: "0917-558-4673 / 0918-873-4673 / (02) 8804-4673" },
];

const CRISIS_RESOURCES_GENERIC: CrisisResource[] = [
  { label: "Find a local crisis line", contact: "findahelpline.com" },
];

export function getCrisisResources(country: string | null | undefined): CrisisResource[] {
  if (country === "PH") return CRISIS_RESOURCES_PH;
  return CRISIS_RESOURCES_GENERIC;
}
