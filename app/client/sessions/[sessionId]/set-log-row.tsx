"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { logSetAction, type LogActionState } from "./actions";

const initialState: LogActionState = { status: "idle" };

export function SetLogRow({
  sessionLogId,
  exerciseId,
  setPrescriptionId,
  setNumber,
  repsMin,
  repsMax,
  defaultLoadKg,
}: {
  sessionLogId: string;
  exerciseId: string;
  setPrescriptionId: string;
  setNumber: number;
  repsMin: number | null;
  repsMax: number | null;
  defaultLoadKg: number;
}) {
  const [state, formAction, isPending] = useActionState(logSetAction, initialState);
  const [showPain, setShowPain] = useState(false);
  const logged = state.status === "success";

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2 border-t py-2 first:border-t-0">
      <input type="hidden" name="sessionLogId" value={sessionLogId} />
      <input type="hidden" name="exerciseId" value={exerciseId} />
      <input type="hidden" name="setPrescriptionId" value={setPrescriptionId} />
      <input type="hidden" name="setNumber" value={setNumber} />
      <span className="w-10 pb-2 text-sm text-muted-foreground">Set {setNumber}</span>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Reps ({repsMin}-{repsMax} target)</span>
        <Input name="reps" type="number" min={0} max={200} defaultValue={repsMax ?? repsMin ?? 8} className="h-9 w-16" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Load (kg)</span>
        <Input name="loadKg" type="number" min={0} max={500} step={0.5} defaultValue={defaultLoadKg} className="h-9 w-20" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">RPE</span>
        <Input name="rpe" type="number" min={1} max={10} step={0.5} className="h-9 w-16" />
      </div>
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "..." : logged ? "Update" : "Log set"}
      </Button>
      <button
        type="button"
        onClick={() => setShowPain((v) => !v)}
        className="text-xs text-muted-foreground underline underline-offset-4"
      >
        Report pain
      </button>

      {showPain && (
        <div className="flex w-full items-end gap-2">
          <label className="flex items-center gap-1 text-xs">
            <input type="checkbox" name="painReported" defaultChecked />
            Pain on this set
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Pain (0-10)</span>
            <Input name="painScore" type="number" min={0} max={10} className="h-8 w-16 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Where</span>
            <Input name="painSite" placeholder="e.g. knee" className="h-8 w-28 text-sm" />
          </div>
        </div>
      )}

      {state.status === "error" && <p className="w-full text-sm text-destructive">{state.message}</p>}
      {state.status === "success" && <p className="w-full text-sm text-primary">{state.message}</p>}
    </form>
  );
}
