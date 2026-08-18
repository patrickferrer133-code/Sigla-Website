import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { getCoachProfileIdForUser } from "@/lib/programs/service";
import { getCoachClientCheckins, getTrendSeries } from "@/lib/checkins/service";
import { isAuthorizedForCoach } from "@/lib/team/service";
import { headlineWeightKg } from "@/lib/domain/checkins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendLineChart } from "@/components/charts/trend-line-chart";
import { ReplyForm } from "./reply-form";
import { BackButton } from "@/components/back-button";

export default async function CoachClientCheckinsPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ as?: string }>;
}) {
  const { clientId } = await params;
  const { as } = await searchParams;
  const user = await requireRole("coach");

  let coachId: string | null;
  if (as) {
    const authorized = await isAuthorizedForCoach(user.id, as);
    if (!authorized) notFound();
    coachId = as;
  } else {
    coachId = await getCoachProfileIdForUser(user.id);
  }
  if (!coachId) notFound();

  // Authorization first, not in parallel with the trend query — a coach
  // must not be able to trigger a trend-data fetch for a client they have
  // no engagement with just by putting an id in the URL (CLAUDE.md:
  // authorization checked server side on every operation, reads included).
  const checkinsResult = await getCoachClientCheckins(coachId, clientId);
  if (!checkinsResult.ok) notFound();

  // getTrendSeries re-checks the engagement itself rather than trusting this
  // call site, and bounds every series to the engagement's end date.
  const trendResult = await getTrendSeries(clientId, { role: "coach", coachId });

  const { checkins: checkinList, clientDisplayName, edRiskFlagged } = checkinsResult.data;
  const weight = trendResult.ok ? trendResult.data.weight : null;
  const adherence = trendResult.ok ? trendResult.data.adherence : [];

  return (
    <div className="mx-auto max-w-2xl">
      <BackButton className="mb-4 self-start" />
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">{clientDisplayName} — check-ins</h1>
        <Link href={`/coach/clients/${clientId}/nutrition`} className="text-sm text-primary underline underline-offset-4">
          Nutrition
        </Link>
      </div>

      {edRiskFlagged && (
        <Card className="mt-4 border-destructive/40 bg-destructive/5">
          <CardContent className="text-sm">
            Weight and measurements are paused for this client as part of an in-app safety screen, so you won&apos;t
            see those numbers here. If you have concerns about their relationship with food, weight, or training,
            consider referring them to a qualified health professional rather than discussing numbers with them
            directly.
          </CardContent>
        </Card>
      )}

      <div className="mt-6 grid gap-6">
        {weight && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Weight — 7-day trend</CardTitle>
            </CardHeader>
            <CardContent>
              <TrendLineChart points={weight.map((w) => ({ label: w.date, value: w.trendKg }))} unit="kg" />
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Adherence — actual completion</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendLineChart points={adherence.map((a) => ({ label: a.weekStart, value: a.actualRate !== null ? a.actualRate * 100 : null }))} unit="%" />
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        {checkinList.length === 0 ? (
          <p className="text-sm text-muted-foreground">This client hasn&apos;t submitted a check-in yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {checkinList.map((c) => (
              <Card key={c.id}>
                <CardHeader>
                  <CardTitle className="text-base">Week of {c.weekOf}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-sm">
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
                    {headlineWeightKg(c.bodyweightKg, c.bodyweightTrendKg) !== null && (
                      <span>Weight trend: {headlineWeightKg(c.bodyweightKg, c.bodyweightTrendKg)?.toFixed(1)}kg</span>
                    )}
                    {c.adherenceTrainingPct !== null && <span>Self-reported training: {c.adherenceTrainingPct}%</span>}
                    {c.adherenceNutritionPct !== null && <span>Nutrition: {c.adherenceNutritionPct}%</span>}
                    {c.avgSteps !== null && <span>{c.avgSteps.toLocaleString()} steps/day</span>}
                    {c.avgSleepHours !== null && <span>{c.avgSleepHours}h sleep</span>}
                  </div>
                  {c.wentWell && (
                    <p>
                      <span className="text-muted-foreground">Went well: </span>
                      {c.wentWell}
                    </p>
                  )}
                  {c.gotInTheWay && (
                    <p>
                      <span className="text-muted-foreground">Got in the way: </span>
                      {c.gotInTheWay}
                    </p>
                  )}
                  <ReplyForm checkinId={c.id} existingReply={c.coachReply} actingAsCoachId={as ?? null} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
