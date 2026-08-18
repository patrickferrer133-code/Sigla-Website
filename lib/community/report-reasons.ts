// Shared by every report UI (community posts and comments, reels) so the
// options a reporter sees are identical on every surface, and by the
// moderation queue for labels. Values must stay in sync with
// reportReasonSchema in ./schemas.ts.
export const REPORT_REASONS = [
  { value: "body_shaming", label: "Body shaming" },
  { value: "harassment", label: "Harassment" },
  { value: "restriction_content", label: "Restriction / disordered eating content" },
  { value: "medical_advice", label: "Unqualified medical advice" },
  { value: "selling_or_poaching", label: "Selling or poaching" },
  { value: "self_harm_risk", label: "Someone may be at risk of harming themselves" },
  { value: "other", label: "Other" },
] as const;

export const REPORT_REASON_LABEL: Record<string, string> = Object.fromEntries(
  REPORT_REASONS.map((reason) => [reason.value, reason.label]),
);
