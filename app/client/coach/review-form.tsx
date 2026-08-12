"use client";

import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { submitReviewAction, type ReviewFormState } from "./actions";

const initialState: ReviewFormState = { status: "idle" };

export function ReviewForm({ engagementId }: { engagementId: string }) {
  const action = submitReviewAction.bind(null, engagementId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const uid = useId();

  if (state.status === "success") {
    return <p className="text-sm font-medium text-primary">Thanks for the review.</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${uid}-rating`} className="text-xs text-muted-foreground">Rating</Label>
        <select id={`${uid}-rating`} name="rating" defaultValue={5} className="h-9 w-24 rounded-md border bg-background px-2 text-sm">
          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${uid}-body`} className="text-xs text-muted-foreground">Review (optional)</Label>
        <Textarea id={`${uid}-body`} name="body" rows={3} />
      </div>
      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Sending..." : "Submit review"}
      </Button>
    </form>
  );
}
