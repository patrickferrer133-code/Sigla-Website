export interface Hook {
  id: string;
  category: "pain_point" | "myth_bust" | "social_proof" | "curiosity" | "relatable";
  text: string;
}

// Starter, freely available on every tier (docs/09 section 4: content
// studio's hook library only tier). Generic enough to fit any coach
// specialty; a coach fills in their own specifics around the hook.
export const HOOK_LIBRARY: Hook[] = [
  { id: "h1", category: "pain_point", text: "You're not lazy. Your program is wrong for your life." },
  { id: "h2", category: "pain_point", text: "The reason your weight keeps bouncing back isn't willpower." },
  { id: "h3", category: "myth_bust", text: "Cardio isn't why you're not losing fat. Here's what actually is." },
  { id: "h4", category: "myth_bust", text: "You don't need to eat 6 meals a day. Nobody ever did." },
  { id: "h5", category: "myth_bust", text: "Lifting heavy won't make you bulky. Here's the actual math." },
  { id: "h6", category: "social_proof", text: "A client told me this after week 12, and it's why I coach." },
  { id: "h7", category: "social_proof", text: "This client trains 3x a week with two kids and a 9-to-5. Here's how." },
  { id: "h8", category: "curiosity", text: "The one thing I check first with every new client, before anything else." },
  { id: "h9", category: "curiosity", text: "What I do differently with clients over 40." },
  { id: "h10", category: "relatable", text: "Missed your workout today? Here's what I'd tell you to do instead of skipping the week." },
  { id: "h11", category: "relatable", text: "You don't need a perfect week. You need a week you didn't quit." },
  { id: "h12", category: "curiosity", text: "Why I stopped prescribing calorie targets to half my clients." },
];

export function listHooksByCategory(category?: Hook["category"]): Hook[] {
  if (!category) return HOOK_LIBRARY;
  return HOOK_LIBRARY.filter((h) => h.category === category);
}
