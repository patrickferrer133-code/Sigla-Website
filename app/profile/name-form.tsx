"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateNameAction, type ProfileFormState } from "./actions";

const initialState: ProfileFormState = { status: "idle" };

export function NameForm({ displayName }: { displayName: string }) {
  const [state, formAction, isPending] = useActionState(updateNameAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Label htmlFor="displayName" className="text-xs text-muted-foreground">Name</Label>
      <div className="flex gap-2">
        <Input id="displayName" name="displayName" defaultValue={displayName} required />
        <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save"}</Button>
      </div>
      {state.status === "error" && <p className="text-xs text-destructive">{state.message}</p>}
      {state.status === "saved" && <p className="text-xs text-primary">Saved.</p>}
    </form>
  );
}
