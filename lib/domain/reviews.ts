const MIN_ENGAGEMENT_DAYS_FOR_REVIEW = 14;

export type ReviewableEngagement = {
  status: "applied" | "accepted" | "active" | "paused" | "ended";
  startedAt: Date | null;
};

/**
 * docs/07 phase 2: "reviews, gated so only clients with a completed
 * engagement of a minimum length can review". No number is specified in the
 * docs, so this picks a floor long enough to rule out a review left before
 * the client has actually trained with the coach.
 */
export function isEligibleForReview(engagement: ReviewableEngagement, now: Date = new Date()): boolean {
  if (!engagement.startedAt) return false;
  if (engagement.status === "applied") return false;
  const elapsedDays = (now.getTime() - engagement.startedAt.getTime()) / (1000 * 60 * 60 * 24);
  return elapsedDays >= MIN_ENGAGEMENT_DAYS_FOR_REVIEW;
}
