import { describe, expect, it } from "vitest";
import { getEntitlementsForTier, canAcceptAnotherClient, hasContentStudioAccess } from "./entitlements";

describe("getEntitlementsForTier", () => {
  it("caps free tier at 3 active clients and no funnel suite", () => {
    const e = getEntitlementsForTier("free");
    expect(e.maxActiveClients).toBe(3);
    expect(e.funnelSuite).toBe(false);
    expect(e.contentStudio).toBe("hooks_only");
  });

  it("gives premium unlimited clients and the full funnel suite", () => {
    const e = getEntitlementsForTier("premium");
    expect(e.maxActiveClients).toBe("unlimited");
    expect(e.funnelSuite).toBe(true);
    expect(e.contentStudio).toBe("full");
  });

  it("take rate falls as tier rises", () => {
    expect(getEntitlementsForTier("free").takeRateBps).toBeGreaterThan(getEntitlementsForTier("pro").takeRateBps);
    expect(getEntitlementsForTier("pro").takeRateBps).toBeGreaterThan(getEntitlementsForTier("premium").takeRateBps);
  });
});

describe("canAcceptAnotherClient", () => {
  it("blocks a free-tier coach at the 3-client cap", () => {
    expect(canAcceptAnotherClient("free", 3)).toBe(false);
    expect(canAcceptAnotherClient("free", 2)).toBe(true);
  });

  it("blocks a pro-tier coach at the 25-client cap", () => {
    expect(canAcceptAnotherClient("pro", 25)).toBe(false);
    expect(canAcceptAnotherClient("pro", 24)).toBe(true);
  });

  it("never blocks a premium-tier coach", () => {
    expect(canAcceptAnotherClient("premium", 10_000)).toBe(true);
  });
});

describe("hasContentStudioAccess", () => {
  it("free tier only clears the hooks_only bar", () => {
    expect(hasContentStudioAccess("free", "hooks_only")).toBe(true);
    expect(hasContentStudioAccess("free", "standard")).toBe(false);
  });

  it("pro tier clears standard but not full", () => {
    expect(hasContentStudioAccess("pro", "standard")).toBe(true);
    expect(hasContentStudioAccess("pro", "full")).toBe(false);
  });

  it("premium clears every level", () => {
    expect(hasContentStudioAccess("premium", "full")).toBe(true);
  });
});
