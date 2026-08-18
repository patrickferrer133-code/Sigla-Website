"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { assignProgramAction, type FormActionState } from "../actions";

const initialState: FormActionState = { status: "idle" };

export function AssignForm({
  templateProgramId,
  assignableEngagements,
}: {
  templateProgramId: string;
  assignableEngagements: { engagementId: string; clientDisplayName: string }[];
}) {
  const [state, formAction, isPending] = useActionState(assignProgramAction, initialState);

  if (assignableEngagements.length === 0) {
    return <p className="text-sm text-muted-foreground">Every active client already has a program assigned.</p>;
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="templateProgramId" value={templateProgramId} />
      <Select
        name="engagementId"
        required
        items={assignableEngagements.map((e) => ({ label: e.clientDisplayName, value: e.engagementId }))}
      >
        <SelectTrigger className="h-9 w-56">
          <SelectValue placeholder="Choose a client" />
        </SelectTrigger>
        <SelectContent>
          {assignableEngagements.map((e) => (
            <SelectItem key={e.engagementId} value={e.engagementId}>
              {e.clientDisplayName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Assigning..." : "Assign program"}
      </Button>
      {state.status === "error" && <p className="w-full text-sm text-destructive">{state.message}</p>}
      {state.status === "success" && <p className="w-full text-sm text-primary">{state.message}</p>}
    </form>
  );
}
