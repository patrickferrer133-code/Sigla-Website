"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCommentAction, type CommentFormState } from "@/lib/community/actions";
import type { CrisisResource } from "@/lib/domain/community-safety";

const initialState: CommentFormState = { status: "idle" };

export function CommentForm({
  postId,
  communityId,
  crisisResources,
}: {
  postId: string;
  communityId: string;
  crisisResources: CrisisResource[];
}) {
  const action = createCommentAction.bind(null, postId, communityId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <div className="mt-2">
      <form action={formAction} className="flex gap-2">
        <Input name="bodyMd" placeholder="Reply" required className="h-8 text-sm" />
        <Button type="submit" size="sm" variant="ghost" disabled={isPending}>
          Reply
        </Button>
      </form>
      {state.status === "error" && <p className="mt-1 text-xs text-destructive">{state.message}</p>}
      {state.status === "commented" && state.showCrisisResources && (
        <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <p className="font-medium">If you&apos;re struggling right now, you don&apos;t have to go through it alone.</p>
          <ul className="mt-2 flex flex-col gap-1">
            {crisisResources.map((r) => (
              <li key={r.label}>
                {r.label}: {r.contact}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
