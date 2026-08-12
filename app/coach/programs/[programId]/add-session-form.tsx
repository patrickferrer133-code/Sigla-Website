"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addSessionAction, type FormActionState } from "../actions";

const initialState: FormActionState = { status: "idle" };

export function AddSessionForm({ programWeekId }: { programWeekId: string }) {
  const [state, formAction, isPending] = useActionState(addSessionAction, initialState);

  return (
    <form action={formAction} className="flex items-end gap-2">
      <input type="hidden" name="programWeekId" value={programWeekId} />
      <div className="flex flex-col gap-1">
        <Input name="name" placeholder="Day A - Full Body" required className="h-8 w-48 text-sm" />
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        {isPending ? "Adding..." : "Add session"}
      </Button>
      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
    </form>
  );
}
