"use client";

import { useActionState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sendClientMessageAction, type SendMessageFormState } from "../actions";

const initialState: SendMessageFormState = { status: "idle" };

export function MessageForm({ engagementId }: { engagementId: string }) {
  const [state, formAction, isPending] = useActionState(sendClientMessageAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "idle" && !isPending) formRef.current?.reset();
  }, [state, isPending]);

  return (
    <form ref={formRef} action={formAction} className="flex items-end gap-2 border-t p-3">
      <input type="hidden" name="engagementId" value={engagementId} />
      <Textarea name="body" placeholder="Write a message..." rows={2} className="flex-1" required />
      <Button type="submit" disabled={isPending}>
        {isPending ? "Sending..." : "Send"}
      </Button>
      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
    </form>
  );
}
