"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { submitGoalAction, type GoalFormState } from "./actions";

const initialState: GoalFormState = { status: "idle" };
type GoalType = "fat_loss" | "muscle_gain" | "strength" | "endurance" | "health" | "habit";

export function GoalForm() {
  const [state, formAction, isPending] = useActionState(submitGoalAction, initialState);
  const [type, setType] = useState<GoalType>("fat_loss");
  const isWeightGoal = type === "fat_loss" || type === "muscle_gain";
  const isStrengthGoal = type === "strength";

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your primary goal</CardTitle>
          <p className="text-sm text-muted-foreground">One goal at a time. You can change this later.</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="type" className="text-xs text-muted-foreground">Goal type</Label>
            <select
              id="type"
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value as GoalType)}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              <option value="fat_loss">Fat loss</option>
              <option value="muscle_gain">Muscle gain</option>
              <option value="strength">Strength</option>
              <option value="endurance">Endurance</option>
              <option value="health">General health</option>
              <option value="habit">Building a habit</option>
            </select>
          </div>

          {isWeightGoal && (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <Label htmlFor="currentWeightKg" className="text-xs text-muted-foreground">Current weight (kg)</Label>
                <Input id="currentWeightKg" name="currentWeightKg" type="number" step={0.1} min={25} max={350} required />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="targetWeightKg" className="text-xs text-muted-foreground">Target weight (kg)</Label>
                <Input id="targetWeightKg" name="targetWeightKg" type="number" step={0.1} min={25} max={350} required />
              </div>
            </div>
          )}

          {isStrengthGoal && (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <Label htmlFor="currentE1rmKg" className="text-xs text-muted-foreground">Current e1RM (kg)</Label>
                <Input id="currentE1rmKg" name="currentE1rmKg" type="number" step={0.5} min={1} max={500} required />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="targetE1rmKg" className="text-xs text-muted-foreground">Target e1RM (kg)</Label>
                <Input id="targetE1rmKg" name="targetE1rmKg" type="number" step={0.5} min={1} max={500} required />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <Label htmlFor="targetDate" className="text-xs text-muted-foreground">Target date</Label>
            <Input id="targetDate" name="targetDate" type="date" required />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="whyNow" className="text-xs text-muted-foreground">Why now?</Label>
            <Textarea id="whyNow" name="whyNow" rows={2} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="successDefinition" className="text-xs text-muted-foreground">
              What would success look like, in your own words?
            </Label>
            <Textarea id="successDefinition" name="successDefinition" rows={2} />
          </div>
        </CardContent>
      </Card>

      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}

      {state.status === "result" && (
        <Card className={state.realism?.verdict === "blocked" ? "border-destructive/40 bg-destructive/5" : ""}>
          <CardHeader>
            <CardTitle className="text-base">
              {state.realism?.verdict === "blocked" ? "Let's rethink this goal" : "Here's the plan"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{state.realism?.message ?? "Goal saved."}</CardContent>
        </Card>
      )}

      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Checking..." : "Save goal"}
      </Button>
    </form>
  );
}
