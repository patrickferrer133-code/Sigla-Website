"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CheckinSummary } from "@/lib/checkins/service";
import { submitCheckinAction, type CheckinFormState } from "./actions";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SCORE_FIELDS = [
  { name: "energy", label: "Energy" },
  { name: "hunger", label: "Hunger" },
  { name: "stress", label: "Stress" },
  { name: "motivation", label: "Motivation" },
  { name: "soreness", label: "Soreness" },
  { name: "mood", label: "Mood" },
] as const;

const initialState: CheckinFormState = { status: "idle" };

export function CheckinForm({
  weekOf,
  dayLabels,
  todayIsoDate,
  existing,
  edRiskFlagged,
  dailyWeightsKg,
}: {
  weekOf: string;
  dayLabels: string[];
  todayIsoDate: string;
  existing: CheckinSummary | null;
  edRiskFlagged: boolean;
  dailyWeightsKg: (number | null)[];
}) {
  const [state, formAction, isPending] = useActionState(submitCheckinAction, initialState);
  // Computed server-side in the client's own timezone (lib/checkins/service.ts
  // getCurrentWeekCheckin) — comparing against a UTC `new Date()` here would
  // disable every day's input for hours around midnight in timezones ahead
  // of UTC (e.g. Asia/Manila, UTC+8, until 08:00 local).
  const today = todayIsoDate;

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-6">
      <input type="hidden" name="weekOf" value={weekOf} />

      {!edRiskFlagged && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bodyweight (optional)</CardTitle>
            <p className="text-xs text-muted-foreground">Any days you weighed in. Skip days you didn&apos;t — that&apos;s normal.</p>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-7">
            {DAY_LABELS.map((label, i) => {
              const isFuture = dayLabels[i] > today;
              return (
                <div key={label} className="flex flex-col gap-1">
                  <Label htmlFor={`weight-${i}`} className="text-xs text-muted-foreground">
                    {label} {dayLabels[i].slice(5)}
                  </Label>
                  <Input
                    id={`weight-${i}`}
                    name={`dailyWeightsKg.${i}`}
                    type="number"
                    inputMode="decimal"
                    step={0.1}
                    min={25}
                    max={350}
                    disabled={isFuture}
                    defaultValue={dailyWeightsKg[i] ?? ""}
                    placeholder="kg"
                    className="h-11"
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {edRiskFlagged && (
        <Card>
          <CardContent className="text-sm text-muted-foreground">
            Weight and measurements are paused on your account for now. If you&apos;d like to talk to someone, our{" "}
            <a href="/support" className="text-primary underline underline-offset-4">
              support resources
            </a>{" "}
            page has options. Everything else below still helps your coach.
          </CardContent>
        </Card>
      )}

      {!edRiskFlagged && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Measurements (optional)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { name: "waistCm", label: "Waist" },
              { name: "hipCm", label: "Hip" },
              { name: "chestCm", label: "Chest" },
              { name: "armCm", label: "Arm" },
              { name: "thighCm", label: "Thigh" },
            ].map((field) => (
              <div key={field.name} className="flex flex-col gap-1">
                <Label htmlFor={field.name} className="text-xs text-muted-foreground">
                  {field.label} (cm)
                </Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="number"
                  inputMode="decimal"
                  step={0.1}
                  defaultValue={existing?.measurements?.[field.name as keyof NonNullable<CheckinSummary["measurements"]>] ?? ""}
                  className="h-11"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adherence and habits (optional)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="adherenceTrainingPct" className="text-xs text-muted-foreground">
              Training adherence %
            </Label>
            <Input id="adherenceTrainingPct" name="adherenceTrainingPct" type="number" inputMode="numeric" min={0} max={100} defaultValue={existing?.adherenceTrainingPct ?? ""} className="h-11" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="adherenceNutritionPct" className="text-xs text-muted-foreground">
              Nutrition adherence %
            </Label>
            <Input id="adherenceNutritionPct" name="adherenceNutritionPct" type="number" inputMode="numeric" min={0} max={100} defaultValue={existing?.adherenceNutritionPct ?? ""} className="h-11" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="avgSteps" className="text-xs text-muted-foreground">
              Avg steps/day
            </Label>
            <Input id="avgSteps" name="avgSteps" type="number" inputMode="numeric" min={0} max={50000} defaultValue={existing?.avgSteps ?? ""} className="h-11" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="avgSleepHours" className="text-xs text-muted-foreground">
              Avg sleep (hrs)
            </Label>
            <Input id="avgSleepHours" name="avgSleepHours" type="number" inputMode="decimal" step={0.5} min={2} max={14} defaultValue={existing?.avgSleepHours ?? ""} className="h-11" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How the week felt (optional)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {SCORE_FIELDS.map((field) => (
            <ScorePicker key={field.name} name={field.name} label={field.label} defaultValue={existing?.[field.name] ?? null} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">In your own words (optional)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="wentWell" className="text-xs text-muted-foreground">
              What went well
            </Label>
            <Textarea id="wentWell" name="wentWell" maxLength={2000} defaultValue={existing?.wentWell ?? ""} rows={3} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="gotInTheWay" className="text-xs text-muted-foreground">
              What got in the way
            </Label>
            <Textarea id="gotInTheWay" name="gotInTheWay" maxLength={2000} defaultValue={existing?.gotInTheWay ?? ""} rows={3} />
          </div>
        </CardContent>
      </Card>

      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}

      <Button type="submit" disabled={isPending} className="h-11 w-full sm:w-fit">
        {isPending ? "Saving..." : existing ? "Update check-in" : "Submit check-in"}
      </Button>
    </form>
  );
}

function ScorePicker({ name, label, defaultValue }: { name: string; label: string; defaultValue: number | null }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <label
            key={value}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-md border text-sm has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground"
          >
            <input type="radio" name={name} value={value} defaultChecked={defaultValue === value} className="sr-only" />
            {value}
          </label>
        ))}
      </div>
    </div>
  );
}
