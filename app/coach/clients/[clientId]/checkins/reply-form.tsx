"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { replyToCheckinAction, type ReplyFormState } from "./actions";

const initialState: ReplyFormState = { status: "idle" };

export function ReplyForm({ checkinId, existingReply }: { checkinId: string; existingReply: string | null }) {
  const [state, formAction, isPending] = useActionState(replyToCheckinAction, initialState);

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-2">
      <input type="hidden" name="checkinId" value={checkinId} />
      <Textarea name="body" defaultValue={existingReply ?? ""} rows={3} placeholder="Write a reply..." />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving..." : existingReply ? "Update reply" : "Send reply"}
        </Button>
        {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
        {state.status === "success" && <p className="text-sm text-primary">{state.message}</p>}
      </div>
    </form>
  );
}
