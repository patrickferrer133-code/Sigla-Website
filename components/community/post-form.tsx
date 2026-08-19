"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FilePicker } from "@/components/file-picker";
import { createPostAction, type PostFormState } from "@/lib/community/actions";
import type { CrisisResource } from "@/lib/domain/community-safety";

const initialState: PostFormState = { status: "idle" };

const ACCEPTED_MEDIA = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime";

export function PostForm({ communityId, crisisResources }: { communityId: string; crisisResources: CrisisResource[] }) {
  const action = createPostAction.bind(null, communityId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-2xl border p-4">
      <Textarea name="bodyMd" rows={3} placeholder="What's on your mind? No judgement here." required />

      <FilePicker name="media" accept={ACCEPTED_MEDIA} buttonLabel="Add photo or video" emptyLabel="No photo or video" />

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isAnonymous" />
        Post anonymously
      </label>
      {/* Anonymity covers the media too: the file is stored under the
          community, never under the poster, and the original filename is
          dropped, so nothing in the URL points back to the author. */}
      <p className="text-xs text-muted-foreground">
        Anonymous posts show your community alias, and that applies to photos and videos you attach as well. Location
        data is stripped from photos on upload. Please don&apos;t post before-and-after or body-comparison images.
      </p>

      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
      {state.status === "posted" && state.showCrisisResources && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
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

      <Button type="submit" disabled={isPending} className="w-fit min-h-11 rounded-full px-5">
        {isPending ? "Posting..." : "Post"}
      </Button>
    </form>
  );
}
