"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export type Reel = {
  id: string;
  coachHandle: string;
  coachDisplayName: string;
  coachAvatarUrl: string | null;
  title: string | null;
  bodyMd: string | null;
  media: { type: "image" | "video"; url: string } | null;
};

export function ReelItem({ reel }: { reel: Reel }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.6 }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  const toggleMute = () => {
    setMuted((prev) => {
      if (videoRef.current) videoRef.current.muted = !prev;
      return !prev;
    });
  };

  const share = async () => {
    const url = `${window.location.origin}/reels#${reel.id}`;
    if (navigator.share) {
      navigator.share({ url, title: reel.title ?? "Sigla reel" }).catch(() => {});
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section id={reel.id} className="relative flex h-svh w-full snap-start items-center justify-center bg-black">
      {reel.media && (
        <video
          ref={videoRef}
          src={reel.media.url}
          className="h-full w-full object-contain"
          loop
          playsInline
          muted={muted}
          preload="metadata"
          onClick={toggleMute}
        />
      )}

      {/* Right action rail */}
      <div className="pointer-events-none absolute inset-y-0 right-0 flex flex-col items-center justify-end gap-5 p-4 pb-28">
        <Link href={`/c/${reel.coachHandle}`} className="pointer-events-auto flex flex-col items-center gap-1">
          <span className="flex size-11 items-center justify-center overflow-hidden rounded-full ring-2 ring-white/80">
            {reel.coachAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL
              <img src={reel.coachAvatarUrl} alt="" className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center bg-primary text-sm font-semibold text-primary-foreground">
                {reel.coachDisplayName.charAt(0).toUpperCase()}
              </span>
            )}
          </span>
        </Link>

        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? "Unmute" : "Mute"}
          className="pointer-events-auto flex size-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
        >
          {muted ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5">
              <path d="M11 5 6 9H2v6h4l5 4V5Z" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5">
              <path d="M11 5 6 9H2v6h4l5 4V5Z" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          )}
        </button>

        <button
          type="button"
          onClick={share}
          aria-label="Share"
          className="pointer-events-auto flex size-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
        >
          {copied ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-5">
              <path d="M18 8a3 3 0 1 0-2.83-4H15a3 3 0 0 0 .05 3.11L8.91 10.7a3 3 0 1 0 0 2.6l6.14 3.59A3 3 0 1 0 15.7 15L9.56 11.4a3 3 0 0 0 0-2.8L15.7 5a3 3 0 0 0 2.3 1Z" />
            </svg>
          )}
        </button>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-6 pr-20 pb-10">
        <div className="pointer-events-auto flex items-end justify-between gap-4">
          <div className="min-w-0 text-white">
            <Link href={`/c/${reel.coachHandle}`} className="font-semibold">
              @{reel.coachHandle}
            </Link>
            {reel.title && <p className="mt-2 text-sm">{reel.title}</p>}
            {reel.bodyMd && <p className="mt-1 line-clamp-2 text-xs text-white/80">{reel.bodyMd}</p>}
          </div>
          <Button render={<Link href={`/c/${reel.coachHandle}`} />} nativeButton={false} className="shrink-0 rounded-full">
            Hire
          </Button>
        </div>
      </div>
    </section>
  );
}
