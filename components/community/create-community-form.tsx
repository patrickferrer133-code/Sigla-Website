"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createCommunityAction, type CreateCommunityState } from "@/lib/community/actions";

const initialState: CreateCommunityState = { status: "idle" };

export function CreateCommunityForm({ basePath }: { basePath: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createCommunityAction, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "created") router.push(`${basePath}/${state.communityId}`);
  }, [state, basePath, router]);

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)} className="min-h-11 rounded-full px-5">
        Create a community
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-2xl border p-4">
      <h2 className="text-base font-semibold">Create a community</h2>
      <Input name="name" placeholder="Community name" required minLength={3} maxLength={80} />
      <Textarea name="description" rows={2} maxLength={500} placeholder="What is this space for?" />

      <label className="flex flex-col gap-1 text-sm">
        Who can join
        <select name="joinPolicy" defaultValue="request" className="h-11 rounded-lg border bg-background px-3 text-sm">
          <option value="request">Anyone can ask to join, you approve</option>
          <option value="open">Anyone can join</option>
        </select>
      </label>

      <p className="text-xs text-muted-foreground">
        Community guidelines apply here: no before-and-after photos, no goal weights or calorie numbers, no unsolicited
        advice on anyone&apos;s body or food. Members can post anonymously and can report anything.
      </p>

      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending} className="min-h-11 rounded-full px-5">
          {isPending ? "Creating..." : "Create"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="min-h-11">
          Cancel
        </Button>
      </div>
    </form>
  );
}
