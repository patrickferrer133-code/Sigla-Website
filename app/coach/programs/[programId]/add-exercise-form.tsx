"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addExerciseAction, type FormActionState } from "../actions";

const initialState: FormActionState = { status: "idle" };

export function AddExerciseForm({
  sessionId,
  exerciseOptions,
}: {
  sessionId: string;
  exerciseOptions: { id: string; name: string }[];
}) {
  const [state, formAction, isPending] = useActionState(addExerciseAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="mt-2 flex flex-wrap items-end gap-2 rounded-md border border-dashed p-2"
    >
      <input type="hidden" name="sessionId" value={sessionId} />
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Exercise</span>
        <Select name="exerciseId" required>
          <SelectTrigger className="h-8 w-56 text-sm">
            <SelectValue placeholder="Choose exercise" />
          </SelectTrigger>
          <SelectContent>
            {exerciseOptions.map((ex) => (
              <SelectItem key={ex.id} value={ex.id}>
                {ex.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Sets</span>
        <Input name="setCount" type="number" min={1} max={10} defaultValue={3} className="h-8 w-16 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Reps min</span>
        <Input name="repsMin" type="number" min={1} max={100} defaultValue={8} className="h-8 w-16 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Reps max</span>
        <Input name="repsMax" type="number" min={1} max={100} defaultValue={12} className="h-8 w-16 text-sm" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Load (kg)</span>
        <Input name="loadKg" type="number" min={0} max={500} step={0.5} defaultValue={20} className="h-8 w-20 text-sm" />
      </div>
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Adding..." : "Add"}
      </Button>
      {state.status === "error" && <p className="w-full text-sm text-destructive">{state.message}</p>}
    </form>
  );
}
