import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { getClientProfileIdForUser } from "@/lib/logging/service";
import { getClientCheckinHistory } from "@/lib/checkins/service";
import { headlineWeightKg } from "@/lib/domain/checkins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackButton } from "@/components/back-button";

export default async function CheckinHistoryPage() {
  const user = await requireRole("client");
  const clientId = await getClientProfileIdForUser(user.id);

  const result = clientId ? await getClientCheckinHistory(clientId) : null;
  const checkinList = result?.ok ? result.data.checkins : [];

  return (
    <div className="mx-auto max-w-2xl">
      <BackButton className="mb-4 self-start" />
      <h1 className="text-2xl font-semibold">Check-in history</h1>

      {checkinList.length === 0 ? (
        <div className="mt-4">
          <p className="text-sm text-muted-foreground">You haven&apos;t submitted a check-in yet.</p>
          <Link href="/client/check-in" className="mt-2 inline-block text-sm text-primary underline underline-offset-4">
            Start this week&apos;s check-in
          </Link>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
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
                  {c.adherenceTrainingPct !== null && <span>Training: {c.adherenceTrainingPct}%</span>}
                  {c.adherenceNutritionPct !== null && <span>Nutrition: {c.adherenceNutritionPct}%</span>}
                  {c.avgSteps !== null && <span>{c.avgSteps.toLocaleString()} steps/day</span>}
                  {c.avgSleepHours !== null && <span>{c.avgSleepHours}h sleep</span>}
                </div>
                {c.wentWell && <p>{c.wentWell}</p>}
                {c.coachReply && (
                  <div className="mt-2 rounded-md bg-muted p-3">
                    <p className="text-xs font-medium text-muted-foreground">Your coach replied</p>
                    <p className="mt-1 whitespace-pre-wrap">{c.coachReply}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
