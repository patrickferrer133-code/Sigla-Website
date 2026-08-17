export type CoachTier = "free" | "pro" | "premium";

export interface Entitlements {
  maxActiveClients: number | "unlimited";
  videoFormReview: boolean;
  contentStudio: "none" | "hooks_only" | "standard" | "full";
  funnelSuite: boolean;
  contentPush: "none" | "limited" | "full";
  analytics: "none" | "basic" | "full";
  assistantSeats: number;
  takeRateBps: number;
}

// docs/09-pricing-system.md section 4. Entitlements are computed in exactly
// this one place and enforced server side — never check `tier === 'premium'`
// inline anywhere else in the codebase.
const ENTITLEMENTS_BY_TIER: Record<CoachTier, Entitlements> = {
  free: {
    maxActiveClients: 3,
    videoFormReview: false,
    contentStudio: "hooks_only",
    funnelSuite: false,
    contentPush: "none",
    analytics: "none",
    assistantSeats: 0,
    takeRateBps: 1200,
  },
  pro: {
    maxActiveClients: 25,
    videoFormReview: true,
    contentStudio: "standard",
    funnelSuite: false,
    contentPush: "limited",
    analytics: "basic",
    assistantSeats: 0,
    takeRateBps: 700,
  },
  premium: {
    maxActiveClients: "unlimited",
    videoFormReview: true,
    contentStudio: "full",
    funnelSuite: true,
    contentPush: "full",
    analytics: "full",
    assistantSeats: 3,
    takeRateBps: 300,
  },
};

export function getEntitlementsForTier(tier: CoachTier): Entitlements {
  return ENTITLEMENTS_BY_TIER[tier];
}

export function canAcceptAnotherClient(tier: CoachTier, currentActiveClients: number): boolean {
  const limit = getEntitlementsForTier(tier).maxActiveClients;
  if (limit === "unlimited") return true;
  return currentActiveClients < limit;
}

export function hasContentStudioAccess(tier: CoachTier, level: "hooks_only" | "standard" | "full"): boolean {
  const order = ["none", "hooks_only", "standard", "full"] as const;
  return order.indexOf(getEntitlementsForTier(tier).contentStudio) >= order.indexOf(level);
}
