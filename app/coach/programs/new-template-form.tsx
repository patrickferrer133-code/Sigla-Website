"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createTemplateAction, type FormActionState } from "./actions";

const initialState: FormActionState = { status: "idle" };

export function NewTemplateForm() {
  const [state, formAction, isPending] = useActionState(createTemplateAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required placeholder="Full Body Foundations" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" placeholder="A 4-week starting point for new clients." />
      </div>
      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Creating..." : "Create template"}
      </Button>
    </form>
  );
}
