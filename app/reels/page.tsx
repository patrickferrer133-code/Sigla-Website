import Link from "next/link";
import { listVideoReelsFeed } from "@/lib/content/service";
import { AmbientBackground } from "@/components/ambient-background";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { ReelsBackButton } from "./reels-back-button";
import { ReelItem } from "./reel-item";

export default async function ReelsPage() {
  const reels = await listVideoReelsFeed();

  if (reels.length === 0) {
    return (
      <div className="relative flex min-h-svh flex-col items-center justify-center px-4 text-center">
        <AmbientBackground />
        <div className="absolute top-4 left-4">
          <BackButton />
        </div>
        <div className="glass-strong flex flex-col items-center gap-3 rounded-3xl p-10">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-7">
              <rect x="2" y="4" width="15" height="16" rx="3" />
              <path d="m17 9 5-3v12l-5-3" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold">No reels yet</h1>
          <p className="max-w-xs text-balance text-sm text-muted-foreground">
            No one has posted a video yet. Check back soon, or browse coaches in the meantime.
          </p>
          <Button render={<Link href="/discover" />} nativeButton={false} className="mt-2 rounded-full px-6">
            Browse coaches
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-svh snap-y snap-mandatory overflow-y-scroll bg-black">
      <div className="pointer-events-none fixed inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent p-4">
        <div className="pointer-events-auto">
          <ReelsBackButton />
        </div>
        <span className="pointer-events-none text-sm font-semibold text-white">Reels</span>
        <span className="w-11" aria-hidden />
      </div>

      {reels.map((reel) => (
        <ReelItem key={reel.id} reel={reel} />
      ))}
    </div>
  );
}
