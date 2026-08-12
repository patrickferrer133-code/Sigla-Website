// The docs/06-safety-privacy-compliance.md section 9 safety test suite,
// tests 5-10. This suite blocks merges (CLAUDE.md hard rule 1). If a test
// here fails, stop and report — do not modify the test to make it pass.

import { describe, expect, it } from "vitest";
import {
  buildFeedPage,
  canAccessProgressPhoto,
  canSendSequenceMessage,
  coachCanAccessClientData,
  promotedRatioWithinCap,
  serializeClientDashboardMetrics,
  serializeCommunityPost,
  type CommunityPostRecord,
} from "./policies";

describe("safety test 5: client dashboard default response contains no weight value when not opted in", () => {
  const raw = {
    bodyweightKg: 72.4,
    bodyweightTrendKg: 72.8,
    sessionsCompleted: 12,
    currentStreakDays: 5,
    e1rmTrend: [{ exerciseId: "back-squat", kg: 100 }],
  };

  it("strips weight fields by default (opted out)", () => {
    const result = serializeClientDashboardMetrics(raw, {
      clientOptedIntoWeightDisplay: false,
      edRiskFlagged: false,
    });
    expect(result.bodyweightKg).toBeNull();
    expect(result.bodyweightTrendKg).toBeNull();
  });

  it("still strips weight even if opted in, when an ED risk flag is active", () => {
    const result = serializeClientDashboardMetrics(raw, {
      clientOptedIntoWeightDisplay: true,
      edRiskFlagged: true,
    });
    expect(result.bodyweightKg).toBeNull();
    expect(result.bodyweightTrendKg).toBeNull();
  });

  it("shows weight only when opted in and no ED risk flag", () => {
    const result = serializeClientDashboardMetrics(raw, {
      clientOptedIntoWeightDisplay: true,
      edRiskFlagged: false,
    });
    expect(result.bodyweightKg).toBe(72.4);
  });
});

describe("safety test 6: anonymous community posts never include author_user_id for a non-admin caller", () => {
  const post: CommunityPostRecord = {
    id: "post-1",
    communityId: "community-1",
    authorUserId: "user-secret-id",
    bodyMd: "I have not trained in 3 weeks and I feel like giving up.",
    isAnonymous: true,
    createdAt: new Date("2026-01-01"),
  };

  it("strips author_user_id for a non-admin viewer", () => {
    const serialized = serializeCommunityPost(post, false);
    expect(serialized.authorUserId).toBeNull();
  });

  it("keeps author_user_id visible to an admin viewer", () => {
    const serialized = serializeCommunityPost(post, true);
    expect(serialized.authorUserId).toBe("user-secret-id");
  });

  it("never strips author_user_id for a non-anonymous post", () => {
    const nonAnonymous = { ...post, isAnonymous: false };
    const serialized = serializeCommunityPost(nonAnonymous, false);
    expect(serialized.authorUserId).toBe("user-secret-id");
  });
});

describe("safety test 7: progress photo access requires a signed URL and an active engagement", () => {
  it("rejects an unsigned request outright", () => {
    expect(
      canAccessProgressPhoto({
        hasValidSignedUrl: false,
        requesterIsOwningClient: true,
        coachHasActiveEngagement: true,
      }),
    ).toBe(false);
  });

  it("rejects a signed request from a coach with no active engagement", () => {
    expect(
      canAccessProgressPhoto({
        hasValidSignedUrl: true,
        requesterIsOwningClient: false,
        coachHasActiveEngagement: false,
      }),
    ).toBe(false);
  });

  it("allows the owning client with a signed URL", () => {
    expect(
      canAccessProgressPhoto({
        hasValidSignedUrl: true,
        requesterIsOwningClient: true,
        coachHasActiveEngagement: false,
      }),
    ).toBe(true);
  });

  it("allows a coach with an active engagement and a signed URL", () => {
    expect(
      canAccessProgressPhoto({
        hasValidSignedUrl: true,
        requesterIsOwningClient: false,
        coachHasActiveEngagement: true,
      }),
    ).toBe(true);
  });
});

describe("safety test 8: sequence sending refuses without consent and honors a global unsubscribe", () => {
  it("refuses without a stored consent record", () => {
    expect(
      canSendSequenceMessage({
        hasStoredConsent: false,
        isGloballyUnsubscribed: false,
        isDisqualifiedForHealthReason: false,
      }),
    ).toBe(false);
  });

  it("refuses for a globally unsubscribed contact even with consent on file", () => {
    expect(
      canSendSequenceMessage({
        hasStoredConsent: true,
        isGloballyUnsubscribed: true,
        isDisqualifiedForHealthReason: false,
      }),
    ).toBe(false);
  });

  it("refuses for a lead disqualified for a health reason", () => {
    expect(
      canSendSequenceMessage({
        hasStoredConsent: true,
        isGloballyUnsubscribed: false,
        isDisqualifiedForHealthReason: true,
      }),
    ).toBe(false);
  });

  it("allows sending with consent, no unsubscribe, and no health disqualification", () => {
    expect(
      canSendSequenceMessage({
        hasStoredConsent: true,
        isGloballyUnsubscribed: false,
        isDisqualifiedForHealthReason: false,
      }),
    ).toBe(true);
  });
});

describe("safety test 9: promoted content ratio in any feed page does not exceed the configured cap", () => {
  it("never exceeds a 1-in-5 cap even with abundant promoted supply", () => {
    const organic = Array.from({ length: 50 }, (_, i) => ({ id: `organic-${i}`, isPromoted: false }));
    const promoted = Array.from({ length: 50 }, (_, i) => ({ id: `promoted-${i}`, isPromoted: true }));

    for (const pageSize of [5, 10, 20, 37]) {
      const page = buildFeedPage(organic, promoted, pageSize, 0.2);
      expect(promotedRatioWithinCap(page, 0.2)).toBe(true);
    }
  });

  it("never exceeds the cap even with scarce organic supply", () => {
    const organic = Array.from({ length: 2 }, (_, i) => ({ id: `organic-${i}`, isPromoted: false }));
    const promoted = Array.from({ length: 50 }, (_, i) => ({ id: `promoted-${i}`, isPromoted: true }));

    const page = buildFeedPage(organic, promoted, 20, 0.2);
    expect(promotedRatioWithinCap(page, 0.2)).toBe(true);
  });
});

describe("safety test 10: an ended engagement revokes coach access to new client data", () => {
  it("denies access to data created after the engagement ended", () => {
    const access = coachCanAccessClientData({
      engagementStatus: "ended",
      engagementEndedAt: new Date("2026-01-01"),
      dataCreatedAt: new Date("2026-01-05"),
      now: new Date("2026-01-05"),
      historicalAccessWindowDays: 30,
    });
    expect(access).toBe(false);
  });

  it("allows historical access to pre-existing data within the retention window", () => {
    const access = coachCanAccessClientData({
      engagementStatus: "ended",
      engagementEndedAt: new Date("2026-01-01"),
      dataCreatedAt: new Date("2025-12-01"),
      now: new Date("2026-01-10"),
      historicalAccessWindowDays: 30,
    });
    expect(access).toBe(true);
  });

  it("revokes historical access once the retention window has passed", () => {
    const access = coachCanAccessClientData({
      engagementStatus: "ended",
      engagementEndedAt: new Date("2026-01-01"),
      dataCreatedAt: new Date("2025-12-01"),
      now: new Date("2026-03-01"),
      historicalAccessWindowDays: 30,
    });
    expect(access).toBe(false);
  });

  it("allows access for active, accepted, and paused engagements", () => {
    for (const status of ["active", "accepted", "paused"] as const) {
      expect(
        coachCanAccessClientData({
          engagementStatus: status,
          engagementEndedAt: null,
          dataCreatedAt: new Date("2026-01-01"),
          historicalAccessWindowDays: 30,
        }),
      ).toBe(true);
    }
  });

  it("denies access for an applied engagement that was never accepted", () => {
    expect(
      coachCanAccessClientData({
        engagementStatus: "applied",
        engagementEndedAt: null,
        dataCreatedAt: new Date("2026-01-01"),
        historicalAccessWindowDays: 30,
      }),
    ).toBe(false);
  });
});
