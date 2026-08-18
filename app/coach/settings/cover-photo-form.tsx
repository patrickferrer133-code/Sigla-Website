"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/file-picker";
import { updateCoverPhotoAction, type SettingsFormState } from "./actions";

const initialState: SettingsFormState = { status: "idle" };

const DEFAULT_COVER_GRADIENT =
  "bg-[linear-gradient(120deg,oklch(0.72_0.16_65)/25,oklch(0.65_0.18_25)/25,oklch(0.7_0.14_200)/25)]";

export function CoverPhotoForm({ coverPhotoUrl }: { coverPhotoUrl: string | null }) {
  const [state, formAction, isPending] = useActionState(updateCoverPhotoAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className={`h-32 w-full overflow-hidden rounded-2xl ${coverPhotoUrl ? "" : DEFAULT_COVER_GRADIENT}`}>
        {coverPhotoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL
          <img src={coverPhotoUrl} alt="" className="size-full object-cover" />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <FilePicker
          name="coverPhoto"
          accept="image/jpeg,image/png,image/webp,image/gif"
          buttonLabel="Choose photo"
        />
        <Button type="submit" disabled={isPending} className="min-h-11 rounded-full px-5">
          {isPending ? "Uploading..." : "Update cover photo"}
        </Button>
      </div>
      {state.status === "error" && <p className="text-xs text-destructive">{state.message}</p>}
      {state.status === "saved" && <p className="text-xs text-primary">Saved.</p>}
    </form>
  );
}
