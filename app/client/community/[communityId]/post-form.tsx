"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createPostAction, type PostFormState } from "./actions";
import type { CrisisResource } from "@/lib/domain/community-safety";

const initialState: PostFormState = { status: "idle" };

export function PostForm({ communityId, crisisResources }: { communityId: string; crisisResources: CrisisResource[] }) {
  const action = createPostAction.bind(null, communityId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Textarea name="bodyMd" rows={3} placeholder="What's on your mind? No judgement here." required />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isAnonymous" />
        Post anonymously
      </label>

      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
      {state.status === "posted" && state.showCrisisResources && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <p className="font-medium">If you&apos;re struggling right now, you don&apos;t have to go through it alone.</p>
          <ul className="mt-2 flex flex-col gap-1">
            {crisisResources.map((r) => (
              <li key={r.label}>{r.label}: {r.contact}</li>
            ))}
          </ul>
        </div>
      )}

      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Posting..." : "Post"}
      </Button>
    </form>
  );
}
