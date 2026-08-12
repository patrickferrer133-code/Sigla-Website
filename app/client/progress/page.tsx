import { requireRole } from "@/lib/auth/require-role";
import { getClientProfileIdForUser } from "@/lib/logging/service";
import { getTrendSeries } from "@/lib/checkins/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendLineChart, type TrendPoint } from "@/components/charts/trend-line-chart";
import { setWeightVisibilityAction } from "./actions";

export default async function ProgressPage() {
  const user = await requireRole("client");
  const clientId = await getClientProfileIdForUser(user.id);
  if (!clientId) {
    return <p className="text-sm text-muted-foreground">Progress shows up here once you have a coach and a plan.</p>;
  }

  const result = await getTrendSeries(clientId, { role: "client" });
  if (!result.ok) {
    return <p className="text-sm text-muted-foreground">Progress shows up here once you have a coach and a plan.</p>;
  }

  const { weight, e1rm, adherence, edRiskFlagged } = result.data;

  const weightPoints: TrendPoint[] | null = weight ? weight.map((w) => ({ label: w.date, value: w.trendKg })) : null;
  const adherencePoints: TrendPoint[] = adherence.map((a) => ({ label: a.weekStart, value: a.actualRate !== null ? a.actualRate * 100 : null }));

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">Progress</h1>
      <p className="mt-1 text-sm text-muted-foreground">Sessions, strength, and habits, not a single day&apos;s number.</p>

      <div className="mt-6 flex flex-col gap-6">
        {weightPoints !== null && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Weight — 7-day trend</CardTitle>
              <form action={setWeightVisibilityAction.bind(null, false)}>
                <Button type="submit" variant="ghost" size="sm">
                  Hide this
                </Button>
              </form>
            </CardHeader>
            <CardContent>
              <TrendLineChart points={weightPoints} unit="kg" />
            </CardContent>
          </Card>
        )}

        {weightPoints === null && !edRiskFlagged && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Weight</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Your weight trend is hidden from your own dashboard by default. Your coach can still see it either
                way, this only changes what you see.
              </p>
              <form action={setWeightVisibilityAction.bind(null, true)}>
                <Button type="submit" variant="outline" size="sm">
                  Show my weight trend
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {e1rm.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Strength (e1RM)</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Not enough logged sets yet to chart your key lifts.</CardContent>
          </Card>
        ) : (
          e1rm.map((lift) => (
            <Card key={lift.exerciseId}>
              <CardHeader>
                <CardTitle className="text-base">{lift.exerciseName} — estimated 1RM</CardTitle>
              </CardHeader>
              <CardContent>
                <TrendLineChart
                  points={lift.points.map((p) => ({ label: p.weekStart, value: p.e1rmKg, isDeload: p.isDeload }))}
                  unit="kg"
                />
              </CardContent>
            </Card>
          ))
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Adherence — sessions completed vs prescribed</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendLineChart points={adherencePoints} unit="%" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
