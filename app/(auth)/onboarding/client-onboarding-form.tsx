"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeClientOnboardingAction, type OnboardingFormState } from "./actions";

const initialState: OnboardingFormState = { status: "idle" };

const EQUIPMENT = [
  { value: "full_gym", label: "Full gym" },
  { value: "home_dumbbells", label: "Dumbbells at home" },
  { value: "home_barbell", label: "Barbell at home" },
  { value: "bands_only", label: "Bands only" },
  { value: "bodyweight_only", label: "Bodyweight only" },
];

export function ClientOnboardingForm() {
  const [state, formAction, isPending] = useActionState(completeClientOnboardingAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="dateOfBirth" className="text-xs text-muted-foreground">Date of birth</Label>
        <Input id="dateOfBirth" name="dateOfBirth" type="date" required />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="sexAtBirth" className="text-xs text-muted-foreground">Sex at birth</Label>
        <p className="text-xs text-muted-foreground">Used only for metabolic calculations. Never shown publicly.</p>
        <select id="sexAtBirth" name="sexAtBirth" defaultValue="prefer_not_to_say" className="h-9 rounded-md border bg-background px-2 text-sm">
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="prefer_not_to_say">Prefer not to say</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="heightCm" className="text-xs text-muted-foreground">Height (cm)</Label>
        <Input id="heightCm" name="heightCm" type="number" min={100} max={250} required />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Equipment access</span>
        <div className="flex flex-col gap-2">
          {EQUIPMENT.map((eq) => (
            <label key={eq.value} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="equipmentAccess" value={eq.value} />
              {eq.label}
            </label>
          ))}
        </div>
      </div>

      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}

      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Saving..." : "Continue"}
      </Button>
    </form>
  );
}
