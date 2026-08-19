"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { reportContentAction } from "@/lib/community/actions";
import { REPORT_REASONS } from "@/lib/community/report-reasons";

// docs/06 section 5: a report route on every post and comment, with a reason
// list and a visible outcome to the reporter.
export function ReportButton({
  targetType,
  targetId,
  communityId,
}: {
  targetType: "community_post" | "community_comment";
  targetId: string;
  communityId: string;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  if (done) return <span className="text-xs text-muted-foreground">Reported. Thanks for flagging this.</span>;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground underline underline-offset-4"
      >
        Report
      </button>
    );
  }

  return (
    <form
      action={async (formData) => {
        await reportContentAction(targetType, targetId, communityId, formData);
        setDone(true);
      }}
      className="mt-1 flex items-center gap-2"
    >
      <select name="reason" className="h-7 rounded-md border bg-background px-1 text-xs" required>
        <option value="">Reason…</option>
        {REPORT_REASONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="ghost" className="h-7 px-2 text-xs">
        Submit
      </Button>
    </form>
  );
}
