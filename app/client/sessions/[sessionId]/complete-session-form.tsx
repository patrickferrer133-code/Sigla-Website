"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeSessionAction, type LogActionState } from "./actions";

const initialState: LogActionState = { status: "idle" };

export function CompleteSessionForm({ sessionLogId }: { sessionLogId: string }) {
  const [state, formAction, isPending] = useActionState(completeSessionAction, initialState);

  return (
    <form action={formAction} className="flex items-end gap-3">
      <input type="hidden" name="sessionLogId" value={sessionLogId} />
      <div className="flex flex-col gap-1">
        <Label htmlFor="sessionRpe" className="text-xs text-muted-foreground">
          How hard was that overall? (RPE 1-10)
        </Label>
        <Input id="sessionRpe" name="sessionRpe" type="number" min={1} max={10} className="h-9 w-20" />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Finishing..." : "Finish session"}
      </Button>
      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
    </form>
  );
}
