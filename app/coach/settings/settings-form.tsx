"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateCoachProfileAction, type SettingsFormState } from "./actions";

const initialState: SettingsFormState = { status: "idle" };

type Defaults = {
  handle: string;
  headline: string | null;
  bio: string | null;
  yearsExperience: number | null;
  specialties: string[] | null;
  languages: string[] | null;
  coachingMode: string[] | null;
  city: string | null;
  country: string | null;
  acceptingClients: boolean;
};

const MODES = [
  { value: "online", label: "Online" },
  { value: "in_person", label: "In person" },
  { value: "hybrid", label: "Hybrid" },
];

export function SettingsForm({ defaults }: { defaults: Defaults }) {
  const [state, formAction, isPending] = useActionState(updateCoachProfileAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="handle" className="text-xs text-muted-foreground">Handle (sigla.app/c/&hellip;)</Label>
        <Input id="handle" name="handle" defaultValue={defaults.handle} required pattern="[a-z0-9-]+" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="headline" className="text-xs text-muted-foreground">Headline</Label>
        <Input id="headline" name="headline" defaultValue={defaults.headline ?? ""} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="bio" className="text-xs text-muted-foreground">Bio</Label>
        <Textarea id="bio" name="bio" rows={4} defaultValue={defaults.bio ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="yearsExperience" className="text-xs text-muted-foreground">Years coaching</Label>
          <Input id="yearsExperience" name="yearsExperience" type="number" min={0} defaultValue={defaults.yearsExperience ?? undefined} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="city" className="text-xs text-muted-foreground">City</Label>
          <Input id="city" name="city" defaultValue={defaults.city ?? ""} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="country" className="text-xs text-muted-foreground">Country</Label>
        <Input id="country" name="country" defaultValue={defaults.country ?? ""} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="specialties" className="text-xs text-muted-foreground">Specialties (comma separated)</Label>
        <Input id="specialties" name="specialties" defaultValue={defaults.specialties?.join(", ") ?? ""} placeholder="fat_loss, strength, hypertrophy" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="languages" className="text-xs text-muted-foreground">Languages (comma separated)</Label>
        <Input id="languages" name="languages" defaultValue={defaults.languages?.join(", ") ?? ""} />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Coaching mode</span>
        <div className="flex gap-4">
          {MODES.map((mode) => (
            <label key={mode.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="coachingMode"
                value={mode.value}
                defaultChecked={defaults.coachingMode?.includes(mode.value)}
              />
              {mode.label}
            </label>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="acceptingClients" defaultChecked={defaults.acceptingClients} />
        Accepting new clients
      </label>

      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
      {state.status === "saved" && <p className="text-sm text-primary">Saved.</p>}

      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Saving..." : "Save profile"}
      </Button>
    </form>
  );
}
