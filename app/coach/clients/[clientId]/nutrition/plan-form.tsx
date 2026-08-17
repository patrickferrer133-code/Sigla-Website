"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createNutritionPlanAction, type NutritionFormState } from "./actions";

const initialState: NutritionFormState = { status: "idle" };

type Approach = "habit_based" | "portion_based" | "macros" | "meal_plan";

export function PlanForm({ clientId }: { clientId: string }) {
  const action = createNutritionPlanAction.bind(null, clientId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [approach, setApproach] = useState<Approach>("habit_based");
  const needsNumbers = approach === "macros" || approach === "meal_plan";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="approach" className="text-xs text-muted-foreground">Approach</Label>
        <select
          id="approach"
          name="approach"
          value={approach}
          onChange={(e) => setApproach(e.target.value as Approach)}
          className="h-9 rounded-md border bg-background px-2 text-sm"
        >
          <option value="habit_based">Habit-based (no numbers)</option>
          <option value="portion_based">Portion / hand-based</option>
          <option value="macros">Flexible macros</option>
          <option value="meal_plan">Meal plan</option>
        </select>
      </div>

      {!needsNumbers && (
        <div className="flex flex-col gap-1">
          <Label htmlFor="habits" className="text-xs text-muted-foreground">Habits (one per line)</Label>
          <Textarea id="habits" name="habits" rows={4} placeholder="Protein at every meal&#10;Vegetables at 2 meals a day&#10;Stop eating 2 hours before bed" />
        </div>
      )}

      {needsNumbers && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="activityLevel" className="text-xs text-muted-foreground">Activity level</Label>
              <select id="activityLevel" name="activityLevel" defaultValue="moderate" className="h-9 rounded-md border bg-background px-2 text-sm">
                <option value="sedentary">Sedentary</option>
                <option value="light">Light</option>
                <option value="moderate">Moderate</option>
                <option value="active">Active</option>
                <option value="very_active">Very active</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="adjustmentPct" className="text-xs text-muted-foreground">Deficit/surplus %</Label>
              <Input id="adjustmentPct" name="adjustmentPct" type="number" step={1} min={-25} max={25} placeholder="-15" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="proteinGPerKg" className="text-xs text-muted-foreground">Protein g/kg (optional)</Label>
              <Input id="proteinGPerKg" name="proteinGPerKg" type="number" step={0.1} min={1} max={3} placeholder="2.0" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="fatGPerKg" className="text-xs text-muted-foreground">Fat g/kg (optional)</Label>
              <Input id="fatGPerKg" name="fatGPerKg" type="number" step={0.1} min={0.4} max={1.5} placeholder="0.8" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Uses the client&apos;s most recent check-in bodyweight. The target is never generated or shown below their
            calculated BMR, no matter what deficit is requested.
          </p>
        </>
      )}

      <div className="flex flex-col gap-1">
        <Label htmlFor="coachNote" className="text-xs text-muted-foreground">Note to yourself (not shown to client)</Label>
        <Textarea id="coachNote" name="coachNote" rows={2} />
      </div>

      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
      {state.status === "saved" && (
        <p className="text-sm text-primary">
          Saved.{state.wasClampedToFloor ? " The target was raised to the client's calculated BMR floor — the requested deficit was too aggressive." : ""}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Saving..." : "Save plan"}
      </Button>
    </form>
  );
}
