"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FilePicker } from "@/components/file-picker";
import { createClientPostAction, type ClientPostFormState } from "./actions";
import type { CrisisResource } from "@/lib/domain/community-safety";

const initialState: ClientPostFormState = { status: "idle" };

export function NewClientPostForm({ crisisResources }: { crisisResources: CrisisResource[] }) {
  const [state, formAction, isPending] = useActionState(createClientPostAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="kind" className="text-xs text-muted-foreground">Type</Label>
        <select id="kind" name="kind" defaultValue="update" className="h-11 rounded-md border bg-background px-3 text-sm">
          <option value="update">Update</option>
          <option value="win">Win</option>
          <option value="video">Video</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="title" className="text-xs text-muted-foreground">Title</Label>
        <Input id="title" name="title" required />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="bodyMd" className="text-xs text-muted-foreground">What do you want to share?</Label>
        <Textarea id="bodyMd" name="bodyMd" rows={5} required />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="tags" className="text-xs text-muted-foreground">Tags (comma separated)</Label>
        <Input id="tags" name="tags" placeholder="first pull-up, consistency" />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">Photo or video (optional)</p>
        <FilePicker
          name="media"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
          buttonLabel="Choose video or photo"
        />
        <p className="text-xs text-muted-foreground">Images up to 8MB, videos up to 100MB.</p>
      </div>

      <label className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
        <input type="checkbox" id="guidelinesAck" name="guidelinesAck" className="mt-0.5 size-4 shrink-0" />
        <span>
          I understand this post is public. No before-and-after or body-comparison photos, no goal weights or
          calorie numbers, no restriction or purging content, and nothing about anyone else&apos;s body or food.
          Your check-in progress photos are private and are never posted here.
        </span>
      </label>

      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
      {state.status === "saved" && <p className="text-sm text-primary">Posted.</p>}
      {state.status === "saved" && state.showCrisisResources && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <p className="font-medium">If you&apos;re struggling right now, you don&apos;t have to go through it alone.</p>
          <ul className="mt-2 flex flex-col gap-1">
            {crisisResources.map((r) => (
              <li key={r.label}>{r.label}: {r.contact}</li>
            ))}
          </ul>
        </div>
      )}

      <Button type="submit" disabled={isPending} className="min-h-11 w-fit px-5">
        {isPending ? "Posting..." : "Post"}
      </Button>
    </form>
  );
}
