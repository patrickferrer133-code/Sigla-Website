"use client";

import { useId, useState } from "react";

/**
 * A friendly replacement for a raw <input type="file">. The native input stays
 * in the DOM (so it still submits with the form and is keyboard operable via
 * its label), but the visible control is a real-looking button plus the name of
 * the chosen file.
 */
export function FilePicker({
  name,
  accept,
  buttonLabel = "Choose photo",
  emptyLabel = "No file chosen",
  className = "",
}: {
  name: string;
  accept: string;
  buttonLabel?: string;
  emptyLabel?: string;
  className?: string;
}) {
  const id = useId();
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <input
        id={id}
        type="file"
        name={name}
        accept={accept}
        className="peer sr-only"
        onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
      />
      <label
        htmlFor={id}
        className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-4 text-sm font-medium whitespace-nowrap transition-colors hover:bg-muted hover:text-foreground peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 dark:border-input dark:bg-input/30 dark:hover:bg-input/50"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4"
          aria-hidden
        >
          <path d="M12 3v12" />
          <path d="m17 8-5-5-5 5" />
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        </svg>
        {buttonLabel}
      </label>
      <span className="min-w-0 truncate text-sm text-muted-foreground">{fileName ?? emptyLabel}</span>
    </div>
  );
}
