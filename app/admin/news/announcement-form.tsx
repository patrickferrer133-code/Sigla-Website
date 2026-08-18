"use client";

import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createAnnouncementAction, type AnnouncementFormState } from "./actions";

const initialAnnouncementFormState: AnnouncementFormState = { status: "idle" };

export function AnnouncementForm() {
  const [state, formAction, isPending] = useActionState<AnnouncementFormState, FormData>(
    createAnnouncementAction,
    initialAnnouncementFormState,
  );
  const uid = useId();
  const fieldId = (name: string) => `${uid}-${name}`;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor={fieldId("title")} className="text-xs text-muted-foreground">Title</Label>
        <Input id={fieldId("title")} name="title" maxLength={140} required />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={fieldId("body")} className="text-xs text-muted-foreground">Body</Label>
        <Textarea id={fieldId("body")} name="body" rows={4} maxLength={4000} required />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={fieldId("audience")} className="text-xs text-muted-foreground">Audience</Label>
        <select
          id={fieldId("audience")}
          name="audience"
          defaultValue="all"
          className="h-9 w-fit rounded-md border bg-background px-2 text-sm"
        >
          <option value="all">Everyone</option>
          <option value="coaches">Coaches only</option>
          <option value="clients">Clients only</option>
        </select>
      </div>

      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
      {state.status === "saved" && <p className="text-sm text-primary">Saved as a draft. Publish it below.</p>}

      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Saving..." : "Create draft"}
      </Button>
    </form>
  );
}
