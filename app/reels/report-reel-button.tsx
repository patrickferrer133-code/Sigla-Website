"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { REPORT_REASONS } from "@/lib/community/report-reasons";
import { reportReelAction } from "./actions";

/**
 * Report control for a reel. Present on every reel regardless of author —
 * coach-authored content is reportable on exactly the same terms as
 * client-authored content (docs/06 section 5). Same reason list as the
 * community report form.
 */
export function ReportReelButton({ postId }: { postId: string }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <span className="pointer-events-none max-w-28 text-center text-[10px] leading-tight text-white/80">
        Reported. A person will look at this.
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Report this post"
        className="pointer-events-auto flex size-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V4s-1 1-4 1-5-2-8-2-4 1-4 1Z" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
      </button>
    );
  }

  return (
    <form
      action={async (formData) => {
        await reportReelAction(postId, formData);
        setDone(true);
        setOpen(false);
      }}
      className="pointer-events-auto flex w-40 flex-col gap-2 rounded-xl bg-black/70 p-2 backdrop-blur-sm"
    >
      <select name="reason" required defaultValue="" className="h-9 w-full rounded-md border border-white/20 bg-black/60 px-1 text-xs text-white">
        <option value="" disabled>
          Reason…
        </option>
        {REPORT_REASONS.map((r) => (
          <option key={r.value} value={r.value} className="text-black">
            {r.label}
          </option>
        ))}
      </select>
      <div className="flex gap-1">
        <Button type="submit" size="sm" className="h-8 flex-1 px-2 text-xs">
          Report
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)} className="h-8 px-2 text-xs text-white hover:bg-white/15">
          Cancel
        </Button>
      </div>
    </form>
  );
}
