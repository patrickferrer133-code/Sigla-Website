"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox, ComboboxInputGroup, ComboboxInput, ComboboxPopup, ComboboxItem } from "@/components/ui/combobox";
import { addExerciseAction, type FormActionState } from "../actions";

const initialState: FormActionState = { status: "idle" };

type ExerciseOption = { id: string; name: string };

export function AddExerciseForm({
  sessionId,
  exerciseOptions,
}: {
  sessionId: string;
  exerciseOptions: ExerciseOption[];
}) {
  const [state, formAction, isPending] = useActionState(addExerciseAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedExercise, setSelectedExercise] = useState<{ value: string; label: string } | null>(null);
  const exerciseItems = exerciseOptions.map((ex) => ({ value: ex.id, label: ex.name }));

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      setSelectedExercise(null);
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="mt-2 flex flex-wrap items-end gap-2 rounded-md border border-dashed p-2"
    >
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="exerciseId" value={selectedExercise?.value ?? ""} />
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Exercise</span>
        <Combobox
          items={exerciseItems}
          value={selectedExercise}
          onValueChange={(value) => setSelectedExercise(value as { value: string; label: string } | null)}
          isItemEqualToValue={(a: { value: string }, b: { value: string }) => a?.value === b?.value}
        >
          <ComboboxInputGroup className="w-56">
            <ComboboxInput placeholder="Search exercises..." />
          </ComboboxInputGroup>
          <ComboboxPopup>
            {(item: { label: string; value: string }) => (
              <ComboboxItem key={item.value} value={item}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxPopup>
        </Combobox>
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
