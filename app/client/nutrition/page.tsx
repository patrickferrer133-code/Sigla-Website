import { requireRole } from "@/lib/auth/require-role";
import { getClientProfileIdForUser } from "@/lib/logging/service";
import { getActiveNutritionPlanForClient } from "@/lib/nutrition/service";
import { BackButton } from "@/components/back-button";

const APPROACH_LABEL: Record<string, string> = {
  habit_based: "Habit-based",
  portion_based: "Portion / hand-based",
  macros: "Flexible macros",
  meal_plan: "Meal plan",
};

export default async function ClientNutritionPage() {
  const user = await requireRole("client");
  const clientId = await getClientProfileIdForUser(user.id);
  if (!clientId) return <p className="text-sm text-muted-foreground">Complete your account first.</p>;

  const plan = await getActiveNutritionPlanForClient(clientId);

  return (
    <div className="mx-auto max-w-xl">
      <BackButton className="mb-4 self-start" />
      <h1 className="text-2xl font-semibold">Nutrition</h1>
      <p className="mt-1 text-sm text-muted-foreground">General guidance from your coach, not medical advice.</p>

      {!plan && <p className="mt-6 text-sm text-muted-foreground">Your coach hasn&apos;t set a nutrition plan yet.</p>}

      {plan && (
        <div className="mt-6 flex flex-col gap-4">
          <p className="text-sm font-medium">{APPROACH_LABEL[plan.approach]}</p>

          {plan.habits && plan.habits.length > 0 && (
            <ul className="list-inside list-disc text-sm">
              {plan.habits.map((h) => <li key={h}>{h}</li>)}
            </ul>
          )}

          {plan.numbers && (
            <div className="rounded-md border p-4 text-sm">
              <p className="font-medium">{plan.numbers.calorieTargetKcal} kcal / day</p>
              <p className="mt-1 text-muted-foreground">
                {plan.numbers.proteinG}g protein · {plan.numbers.fatG}g fat · {plan.numbers.carbsG}g carbs
              </p>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
