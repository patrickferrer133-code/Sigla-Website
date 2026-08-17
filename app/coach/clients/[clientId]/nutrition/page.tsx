import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { getCoachProfileIdForUser } from "@/lib/programs/service";
import { getCoachClientCheckins } from "@/lib/checkins/service";
import { getActiveNutritionPlanForCoach } from "@/lib/nutrition/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlanForm } from "./plan-form";

const APPROACH_LABEL: Record<string, string> = {
  habit_based: "Habit-based",
  portion_based: "Portion / hand-based",
  macros: "Flexible macros",
  meal_plan: "Meal plan",
};

export default async function CoachClientNutritionPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const user = await requireRole("coach");
  const coachId = await getCoachProfileIdForUser(user.id);
  if (!coachId) notFound();

  const access = await getCoachClientCheckins(coachId, clientId);
  if (!access.ok) notFound();

  const plan = await getActiveNutritionPlanForCoach(clientId);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">{access.data.clientDisplayName} — nutrition</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        General guidance only — not medical nutrition therapy. Refer out for any diagnosed condition.
      </p>

      {access.data.edRiskFlagged && (
        <Card className="mt-4 border-destructive/40 bg-destructive/5">
          <CardContent className="text-sm">
            This client has an active eating-disorder risk flag. Any numeric target you set here will not be shown to
            them — they&apos;ll see the plan&apos;s habits and your note only. Consider referring them to a qualified
            health professional before continuing nutrition coaching.
          </CardContent>
        </Card>
      )}

      {plan && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Current plan: {APPROACH_LABEL[plan.approach]}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {plan.habits && plan.habits.length > 0 && (
              <ul className="list-inside list-disc text-muted-foreground">
                {plan.habits.map((h) => <li key={h}>{h}</li>)}
              </ul>
            )}
            {plan.calorieTargetKcal !== null && (
              <p className="text-muted-foreground">
                {plan.calorieTargetKcal} kcal · {plan.proteinG}g protein · {plan.fatG}g fat · {plan.carbsG}g carbs
                {plan.wasClampedToFloor && " (raised to BMR floor)"}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">{plan ? "Update plan" : "Set a plan"}</CardTitle>
        </CardHeader>
        <CardContent>
          <PlanForm clientId={clientId} />
        </CardContent>
      </Card>
    </div>
  );
}
