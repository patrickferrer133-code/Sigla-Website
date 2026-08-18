"use client";

import { useRouter } from "next/navigation";

/**
 * A consistent "go back" affordance for every sub-page of the coach, client and
 * admin apps. Uses router.back() so it returns the person to wherever they
 * actually came from rather than a guessed parent route.
 */
export function BackButton({ label = "Back", className = "" }: { label?: string; className?: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className={`glass inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:min-h-9 ${className}`}
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
        <path d="m15 18-6-6 6-6" />
      </svg>
      {label}
    </button>
  );
}
