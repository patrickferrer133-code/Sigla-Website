"use client";

import { Button } from "@/components/ui/button";
import { togglePublishAction } from "./actions";

export function PublishToggle({ packageId, isPublished }: { packageId: string; isPublished: boolean }) {
  return (
    <form action={togglePublishAction.bind(null, packageId, !isPublished)}>
      <Button type="submit" variant={isPublished ? "ghost" : "default"} size="sm">
        {isPublished ? "Unpublish" : "Publish"}
      </Button>
    </form>
  );
}
