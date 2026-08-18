"use client";

import { Button } from "@/components/ui/button";
import { deleteAnnouncementAction, togglePublishAction } from "./actions";

export function AnnouncementControls({ announcementId, isPublished }: { announcementId: string; isPublished: boolean }) {
  return (
    <div className="flex gap-2">
      <form action={togglePublishAction.bind(null, announcementId, !isPublished)}>
        <Button type="submit" variant={isPublished ? "ghost" : "default"} size="sm">
          {isPublished ? "Unpublish" : "Publish"}
        </Button>
      </form>
      <form action={deleteAnnouncementAction.bind(null, announcementId)}>
        <Button type="submit" variant="ghost" size="sm" className="text-destructive">
          Delete
        </Button>
      </form>
    </div>
  );
}
