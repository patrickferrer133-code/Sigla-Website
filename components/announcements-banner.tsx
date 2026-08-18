"use client";

import { useState } from "react";

export type BannerAnnouncement = {
  id: string;
  title: string;
  body: string;
  publishedAt: Date | null;
};

/**
 * Supplementary platform news above the main dashboard content. Dismissal is
 * purely visual for v1 — no read-tracking, nothing written to the database.
 */
export function AnnouncementsBanner({ announcements }: { announcements: BannerAnnouncement[] }) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const visible = announcements.filter((a) => !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="mb-4 flex flex-col gap-2">
      {visible.map((item) => (
        <div key={item.id} className="glass flex items-start gap-3 rounded-2xl px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{item.title}</p>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.body}</p>
          </div>
          <button
            type="button"
            onClick={() => setDismissed((prev) => [...prev, item.id])}
            aria-label={`Dismiss ${item.title}`}
            className="-mr-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
              aria-hidden
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
