"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviteTeamMemberAction, type InviteFormState } from "./actions";

const initialState: InviteFormState = { status: "idle" };

export function InviteForm() {
  const [state, formAction, isPending] = useActionState(inviteTeamMemberAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor="email" className="text-xs text-muted-foreground">Assistant&apos;s email (must have a Sigla coach account already)</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <Button type="submit" disabled={isPending}>{isPending ? "Adding..." : "Add"}</Button>
      </div>
      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
      {state.status === "invited" && <p className="text-sm text-primary">Added.</p>}
    </form>
  );
}
