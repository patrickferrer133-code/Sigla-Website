import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { getClientProfileIdForUser } from "@/lib/logging/service";
import { listClientEngagementsForReview } from "@/lib/marketplace/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReviewForm } from "./review-form";

const STATUS_LABEL: Record<string, string> = {
  applied: "Application pending",
  accepted: "Accepted",
  active: "Active",
  paused: "Paused",
  ended: "Ended",
};

export default async function MyCoachPage() {
  const user = await requireRole("client");
  const clientId = await getClientProfileIdForUser(user.id);
  if (!clientId) return <p className="text-sm text-muted-foreground">Complete your account first.</p>;

  const engagements = await listClientEngagementsForReview(clientId);

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold">Your coaching history</h1>

      {engagements.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">
          You haven&apos;t applied to a coach yet.{" "}
          <Link href="/discover" className="text-primary underline underline-offset-4">Browse coaches</Link>
        </p>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {engagements.map((eng) => (
          <Card key={eng.engagementId}>
            <CardHeader>
              <CardTitle className="flex items-baseline justify-between text-base">
                <Link href={`/c/${eng.coachHandle}`} className="hover:underline">{eng.coachDisplayName}</Link>
                <span className="text-sm font-normal text-muted-foreground">{STATUS_LABEL[eng.status] ?? eng.status}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {eng.trialEndsAt && new Date(eng.trialEndsAt) > new Date() && (
                <p className="mb-2 text-sm text-primary">
                  Free trial ends {new Date(eng.trialEndsAt).toLocaleDateString()}
                </p>
              )}
              {eng.hasReviewed && <p className="text-sm text-muted-foreground">You reviewed this coach.</p>}
              {!eng.hasReviewed && eng.isEligible && <ReviewForm engagementId={eng.engagementId} />}
              {!eng.hasReviewed && !eng.isEligible && (
                <p className="text-sm text-muted-foreground">
                  You can leave a review once you&apos;ve worked with this coach a bit longer.
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
