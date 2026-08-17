"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeCoachOnboardingAction, type OnboardingFormState } from "./actions";

const initialState: OnboardingFormState = { status: "idle" };

export function CoachOnboardingForm() {
  const [state, formAction, isPending] = useActionState(completeCoachOnboardingAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="handle" className="text-xs text-muted-foreground">Handle (sigla.app/c/&hellip;)</Label>
        <Input id="handle" name="handle" required pattern="[a-z0-9-]+" placeholder="your-name" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="headline" className="text-xs text-muted-foreground">Headline</Label>
        <Input id="headline" name="headline" placeholder="Fat loss coaching for busy parents" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="specialties" className="text-xs text-muted-foreground">Specialties (comma separated)</Label>
        <Input id="specialties" name="specialties" placeholder="fat_loss, strength, hypertrophy" />
      </div>

      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}

      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Saving..." : "Continue"}
      </Button>
    </form>
  );
}
