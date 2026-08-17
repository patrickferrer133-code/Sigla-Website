"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { updateAvatarAction, type ProfileFormState } from "./actions";

const initialState: ProfileFormState = { status: "idle" };

export function AvatarForm({ avatarUrl, displayName }: { avatarUrl: string | null; displayName: string }) {
  const [state, formAction, isPending] = useActionState(updateAvatarAction, initialState);

  return (
    <form action={formAction} className="flex flex-col items-center gap-3">
      <div className="glass flex size-24 items-center justify-center overflow-hidden rounded-full text-2xl font-semibold text-primary">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL
          <img src={avatarUrl} alt="" className="size-full object-cover" />
        ) : (
          displayName.charAt(0).toUpperCase()
        )}
      </div>
      <input type="file" name="avatar" accept="image/jpeg,image/png,image/webp,image/gif" className="text-xs" />
      <Button type="submit" size="sm" disabled={isPending} className="rounded-full">
        {isPending ? "Uploading..." : "Update photo"}
      </Button>
      {state.status === "error" && <p className="text-xs text-destructive">{state.message}</p>}
      {state.status === "saved" && <p className="text-xs text-primary">Saved.</p>}
    </form>
  );
}
