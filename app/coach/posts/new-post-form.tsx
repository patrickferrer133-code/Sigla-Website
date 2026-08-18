"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FilePicker } from "@/components/file-picker";
import { createPostAction, type PostFormState } from "./actions";

const initialState: PostFormState = { status: "idle" };

export function NewPostForm() {
  const [state, formAction, isPending] = useActionState(createPostAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="kind" className="text-xs text-muted-foreground">Type</Label>
          <select id="kind" name="kind" defaultValue="article" className="h-11 rounded-md border bg-background px-3 text-sm">
            <option value="case_study">Case study</option>
            <option value="article">Article</option>
            <option value="program_showcase">Program showcase</option>
            <option value="video">Video</option>
            <option value="win">Win</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="visibility" className="text-xs text-muted-foreground">Visibility</Label>
          <select id="visibility" name="visibility" defaultValue="public" className="h-11 rounded-md border bg-background px-3 text-sm">
            <option value="public">Public</option>
            <option value="clients_only">Clients only</option>
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="title" className="text-xs text-muted-foreground">Title</Label>
        <Input id="title" name="title" required />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="bodyMd" className="text-xs text-muted-foreground">Body</Label>
        <Textarea id="bodyMd" name="bodyMd" rows={5} required />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="tags" className="text-xs text-muted-foreground">Tags (comma separated)</Label>
        <Input id="tags" name="tags" placeholder="fat loss, strength" />
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

      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
      {state.status === "saved" && <p className="text-sm text-primary">Posted.</p>}

      <Button type="submit" disabled={isPending} className="min-h-11 w-fit px-5">
        {isPending ? "Posting..." : "Post"}
      </Button>
    </form>
  );
}
