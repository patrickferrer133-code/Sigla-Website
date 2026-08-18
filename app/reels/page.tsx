import Link from "next/link";
import { listVideoReelsFeed } from "@/lib/content/service";
import { BackButton } from "@/components/back-button";
import { ReelsBackButton } from "./reels-back-button";
import { ReelItem } from "./reel-item";

export default async function ReelsPage() {
  const reels = await listVideoReelsFeed();

  if (reels.length === 0) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center px-4 text-center">
        <div className="absolute top-4 left-4">
          <BackButton />
        </div>
        <h1 className="text-2xl font-semibold">No reels yet</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Coaches haven&apos;t posted any videos yet. Check back soon, or{" "}
          <Link href="/discover" className="text-primary underline underline-offset-4">browse coaches</Link> in the meantime.
        </p>
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
