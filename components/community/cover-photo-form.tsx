"use client";

import { useActionState } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/file-picker";
import { updateCommunityCoverPhotoAction, type CoverPhotoState } from "@/lib/community/actions";

const initialState: CoverPhotoState = { status: "idle" };

/**
 * Owner-only inline edit control on an otherwise read-only page, same pattern
 * as the coach settings cover photo form. Hiding this is a convenience only —
 * the action re-checks ownership on the server.
 */
export function CommunityCoverPhotoForm({ communityId }: { communityId: string }) {
  const [open, setOpen] = useState(false);
  const action = updateCommunityCoverPhotoAction.bind(null, communityId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)} className="rounded-full">
        Change cover photo
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <FilePicker name="coverPhoto" accept="image/jpeg,image/png,image/webp,image/gif" buttonLabel="Choose photo" />
      <Button type="submit" disabled={isPending} className="min-h-11 rounded-full px-5">
        {isPending ? "Uploading..." : "Save cover"}
      </Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="min-h-11">
        Cancel
      </Button>
      {state.status === "error" && <p className="w-full text-xs text-destructive">{state.message}</p>}
      {state.status === "saved" && <p className="w-full text-xs text-primary">Saved.</p>}
    </form>
  );
}
