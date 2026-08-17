export interface ScriptTemplate {
  id: string;
  pillar: "education" | "case_study" | "myth_bust" | "behind_the_scenes";
  title: string;
  structure: { label: string; prompt: string }[];
}

// Pro and above (docs/09 section 4: "Scripts, calendar, seeds"). Structured
// short-form video/post scaffolds — the coach fills in their own specifics,
// this just removes the blank-page problem.
export const SCRIPT_TEMPLATES: ScriptTemplate[] = [
  {
    id: "s1",
    pillar: "education",
    title: "The one-thing explainer",
    structure: [
      { label: "Hook (0-3s)", prompt: "State the one thing most people get wrong about [topic]." },
      { label: "Why it's wrong", prompt: "Explain briefly why the common belief fails in practice." },
      { label: "What to do instead", prompt: "Give the one actionable correction." },
      { label: "CTA", prompt: "Invite a comment or DM with their specific situation." },
    ],
  },
  {
    id: "s2",
    pillar: "case_study",
    title: "Client transformation, told honestly",
    structure: [
      { label: "Hook (0-3s)", prompt: "Open with the client's starting point in their own words, not yours." },
      { label: "The turn", prompt: "What changed — one specific adjustment, not a montage of everything." },
      { label: "The result", prompt: "State the real, specific outcome. No before/after body shots per community guidelines." },
      { label: "CTA", prompt: "Invite people in a similar spot to reach out." },
    ],
  },
  {
    id: "s3",
    pillar: "myth_bust",
    title: "Myth vs. reality",
    structure: [
      { label: "Hook (0-3s)", prompt: "State the myth plainly, as something people actually believe." },
      { label: "Reality", prompt: "One or two sentences of the actual mechanism." },
      { label: "Proof", prompt: "A simple example or number that makes it click." },
      { label: "CTA", prompt: "Ask what other myths they want busted." },
    ],
  },
  {
    id: "s4",
    pillar: "behind_the_scenes",
    title: "A day in your coaching practice",
    structure: [
      { label: "Hook (0-3s)", prompt: "Open mid-action — reviewing a check-in, adjusting a program." },
      { label: "The decision", prompt: "Narrate one real decision you made and why." },
      { label: "The takeaway", prompt: "What this shows about how you coach." },
      { label: "CTA", prompt: "Invite people curious about working with you to check your profile." },
    ],
  },
];

export function listScriptTemplatesByPillar(pillar?: ScriptTemplate["pillar"]): ScriptTemplate[] {
  if (!pillar) return SCRIPT_TEMPLATES;
  return SCRIPT_TEMPLATES.filter((s) => s.pillar === pillar);
}
