"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { submitIntakeAction, type IntakeFormState } from "./actions";

const PARQ_QUESTIONS = [
  { name: "cardiacSymptoms", label: "Has a doctor ever said you have a heart condition?" },
  { name: "chestPain", label: "Do you feel chest pain during physical activity, or at rest?" },
  { name: "dizzinessOrLossOfConsciousness", label: "Have you lost your balance from dizziness, or lost consciousness, in the last 12 months?" },
  { name: "uncontrolledBloodPressure", label: "Do you have high blood pressure that isn't well controlled?" },
  { name: "doctorSupervisionRequired", label: "Has a doctor said you should only exercise under medical supervision?" },
] as const;

const initialState: IntakeFormState = { status: "idle" };

export function IntakeForm() {
  const [state, formAction, isPending] = useActionState(submitIntakeAction, initialState);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">A quick health check</CardTitle>
          <p className="text-sm text-muted-foreground">
            Standard questions before any program starts. A yes here just means a quick doctor sign-off makes your
            plan safer, it doesn&apos;t stop you from using the app.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {PARQ_QUESTIONS.map((q) => (
            <label key={q.name} className="flex items-start gap-2 text-sm">
              <input type="checkbox" name={q.name} className="mt-1" />
              {q.label}
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">About you</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="heightCm" className="text-xs text-muted-foreground">Height (cm)</Label>
            <Input id="heightCm" name="heightCm" type="number" inputMode="decimal" min={100} max={230} required />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="sexAtBirth" className="text-xs text-muted-foreground">Sex at birth</Label>
            <select id="sexAtBirth" name="sexAtBirth" className="h-9 rounded-md border bg-background px-2 text-sm" defaultValue="prefer_not_to_say">
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="trainingAgeMonths" className="text-xs text-muted-foreground">Months training</Label>
            <Input id="trainingAgeMonths" name="trainingAgeMonths" type="number" min={0} max={600} defaultValue={0} required />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="daysAvailable" className="text-xs text-muted-foreground">Days/week available</Label>
            <Input id="daysAvailable" name="daysAvailable" type="number" min={1} max={7} defaultValue={3} required />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="sessionMinutesMax" className="text-xs text-muted-foreground">Minutes/session</Label>
            <Input id="sessionMinutesMax" name="sessionMinutesMax" type="number" min={10} max={240} defaultValue={45} required />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="sleepHours" className="text-xs text-muted-foreground">Usual sleep (hrs)</Label>
            <Input id="sleepHours" name="sleepHours" type="number" step={0.5} min={0} max={16} defaultValue={7} required />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="stressLevel" className="text-xs text-muted-foreground">Stress level (1-5)</Label>
            <Input id="stressLevel" name="stressLevel" type="number" min={1} max={5} defaultValue={3} required />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label htmlFor="pregnancyStatus" className="text-xs text-muted-foreground">Pregnancy status</Label>
            <select id="pregnancyStatus" name="pregnancyStatus" className="h-9 rounded-md border bg-background px-2 text-sm" defaultValue="prefer_not_to_say">
              <option value="not_pregnant">Not pregnant</option>
              <option value="pregnant">Pregnant</option>
              <option value="postpartum">Postpartum</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Injuries and conditions (optional)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="conditions" className="text-xs text-muted-foreground">Conditions (comma separated)</Label>
            <Input id="conditions" name="conditions" placeholder="e.g. asthma, knee injury" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="medications" className="text-xs text-muted-foreground">Medications (comma separated)</Label>
            <Input id="medications" name="medications" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="notes" className="text-xs text-muted-foreground">Anything else your coach should know</Label>
            <Textarea id="notes" name="notes" rows={3} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">A few private questions</CardTitle>
          <p className="text-sm text-muted-foreground">
            These help us keep this a safe space. Answer honestly, nothing here is shared with your coach directly.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="makesSelfSick" className="mt-1" />
            Do you make yourself sick because you feel uncomfortably full?
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="lossOfControl" className="mt-1" />
            Do you worry you have lost control over how much you eat?
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="recentOneStoneLoss" className="mt-1" />
            Have you recently lost more than 6kg in a 3 month period?
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="believesSelfFat" className="mt-1" />
            Do you believe yourself to be fat when others say you are too thin?
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="foodDominatesLife" className="mt-1" />
            Would you say that food dominates your life?
          </label>
        </CardContent>
      </Card>

      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}

      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Saving..." : "Continue"}
      </Button>
    </form>
  );
}
