// Cross-cutting access-control and serialization policies that back the
// docs/06-safety-privacy-compliance.md section 9 safety test suite. These
// are pure functions so the rule can be unit tested independently of the
// API routes, storage signing, and DB queries that will call them in later
// phases — the policy itself ships now, wiring follows.

// --- Progress photos (safety test 7) ---------------------------------------
// docs/06 section 3 / docs/03 section 11: photo endpoints reject unsigned
// requests and requests from a coach without an active engagement.
export function canAccessProgressPhoto(params: {
  hasValidSignedUrl: boolean;
  requesterIsOwningClient: boolean;
  coachHasActiveEngagement: boolean;
}): boolean {
  if (!params.hasValidSignedUrl) return false;
  return params.requesterIsOwningClient || params.coachHasActiveEngagement;
}

// --- Community posts (safety test 6) ---------------------------------------
// docs/03 section 11 / CLAUDE.md rule 4: author_user_id is never exposed for
// an anonymous post to a non-admin caller, in any response, log, or event.
export interface CommunityPostRecord {
  id: string;
  communityId: string;
  authorUserId: string;
  bodyMd: string;
  isAnonymous: boolean;
  createdAt: Date;
}

export type SerializedCommunityPost = Omit<CommunityPostRecord, "authorUserId"> & {
  authorUserId: string | null;
};

export function serializeCommunityPost(
  post: CommunityPostRecord,
  viewerIsAdmin: boolean,
): SerializedCommunityPost {
  const shouldHideAuthor = post.isAnonymous && !viewerIsAdmin;
  return {
    ...post,
    authorUserId: shouldHideAuthor ? null : post.authorUserId,
  };
}

// --- Client dashboard (safety test 5) ---------------------------------------
// docs/06 section 3: weight is hidden by default; the client opts in.
export interface ClientDashboardMetrics {
  bodyweightKg: number | null;
  bodyweightTrendKg: number | null;
  sessionsCompleted: number;
  currentStreakDays: number;
  e1rmTrend: { exerciseId: string; kg: number }[];
}

export function serializeClientDashboardMetrics(
  raw: ClientDashboardMetrics,
  params: { clientOptedIntoWeightDisplay: boolean; edRiskFlagged: boolean },
): ClientDashboardMetrics {
  const shouldShowWeight = params.clientOptedIntoWeightDisplay && !params.edRiskFlagged;
  if (shouldShowWeight) return raw;
  return { ...raw, bodyweightKg: null, bodyweightTrendKg: null };
}

// --- Sequences (safety test 8) ----------------------------------------------
// docs/05 section 4 / docs/06 section 9: sending refuses without a stored
// consent record, and honors a global unsubscribe.
export function canSendSequenceMessage(params: {
  hasStoredConsent: boolean;
  isGloballyUnsubscribed: boolean;
  isDisqualifiedForHealthReason: boolean;
}): boolean {
  if (!params.hasStoredConsent) return false;
  if (params.isGloballyUnsubscribed) return false;
  if (params.isDisqualifiedForHealthReason) return false;
  return true;
}

// --- Promoted content (safety test 9) ---------------------------------------
// docs/04 section 3.4 / docs/05 section 5: promoted content is capped at a
// maximum share of any feed page (default 1 in 5) and never outranks organic
// content beyond that ratio.
export interface FeedItem {
  id: string;
  isPromoted: boolean;
}

export function buildFeedPage<T extends FeedItem>(
  organicItemsRankedDesc: readonly T[],
  promotedItemsRankedDesc: readonly T[],
  pageSize: number,
  capFraction = 0.2,
): T[] {
  // e.g. capFraction 0.2 -> every 5th slot is eligible for a promoted item.
  const slotInterval = Math.max(1, Math.round(1 / capFraction));
  const page: T[] = [];
  let organicIndex = 0;
  let promotedIndex = 0;

  while (
    page.length < pageSize &&
    (organicIndex < organicItemsRankedDesc.length || promotedIndex < promotedItemsRankedDesc.length)
  ) {
    const nextSlotIsPromoted = (page.length + 1) % slotInterval === 0;

    if (nextSlotIsPromoted && promotedIndex < promotedItemsRankedDesc.length) {
      page.push(promotedItemsRankedDesc[promotedIndex]);
      promotedIndex += 1;
    } else if (organicIndex < organicItemsRankedDesc.length) {
      page.push(organicItemsRankedDesc[organicIndex]);
      organicIndex += 1;
    } else if (promotedIndex < promotedItemsRankedDesc.length) {
      // Organic supply is exhausted. Only keep adding promoted items if doing
      // so still respects the cap — never pad a thin page with promotion.
      const promotedCount = page.filter((item) => item.isPromoted).length;
      if ((promotedCount + 1) / (page.length + 1) <= capFraction) {
        page.push(promotedItemsRankedDesc[promotedIndex]);
        promotedIndex += 1;
      } else {
        break;
      }
    } else {
      break;
    }
  }

  return page;
}

export function promotedRatioWithinCap(items: readonly FeedItem[], capFraction = 0.2): boolean {
  if (items.length === 0) return true;
  const promotedCount = items.filter((item) => item.isPromoted).length;
  return promotedCount / items.length <= capFraction + Number.EPSILON;
}

// --- Engagement data access (safety test 10) --------------------------------
// docs/03 section 11: coach access ends when the engagement ends. Historical
// access is retained for a defined window, then revoked.
export type EngagementStatus = "applied" | "accepted" | "active" | "paused" | "ended";

export function coachCanAccessClientData(params: {
  engagementStatus: EngagementStatus;
  engagementEndedAt: Date | null;
  dataCreatedAt: Date;
  now?: Date;
  historicalAccessWindowDays: number;
}): boolean {
  if (params.engagementStatus !== "ended") {
    return params.engagementStatus === "accepted" || params.engagementStatus === "active" || params.engagementStatus === "paused";
  }

  // Ended: new data (created after the engagement ended) is never visible.
  if (!params.engagementEndedAt || params.dataCreatedAt.getTime() > params.engagementEndedAt.getTime()) {
    return false;
  }

  const now = params.now ?? new Date();
  const daysSinceEnded = (now.getTime() - params.engagementEndedAt.getTime()) / (24 * 60 * 60 * 1000);
  return daysSinceEnded <= params.historicalAccessWindowDays;
}
