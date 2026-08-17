import Link from "next/link";
import { listVideoReelsFeed } from "@/lib/content/service";
import { Button } from "@/components/ui/button";

export default async function ReelsPage() {
  const reels = await listVideoReelsFeed();

  if (reels.length === 0) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-semibold">No reels yet</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Coaches haven&apos;t posted any videos yet. Check back soon, or{" "}
          <Link href="/discover" className="text-primary underline underline-offset-4">browse coaches</Link> in the meantime.
        </p>
      </div>
    );
  }

  return (
    <div className="h-svh snap-y snap-mandatory overflow-y-scroll bg-black">
      {reels.map((reel) => (
        <section key={reel.id} className="relative flex h-svh w-full snap-start items-center justify-center">
          {reel.media && (
            <video
              src={reel.media.url}
              className="h-full w-full object-contain"
              controls
              loop
              playsInline
              muted
              autoPlay
              preload="metadata"
            />
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-6 pb-10">
            <div className="pointer-events-auto flex items-end justify-between gap-4">
              <div className="text-white">
                <Link href={`/c/${reel.coachHandle}`} className="flex items-center gap-2 font-semibold">
                  <span className="glass flex size-8 items-center justify-center overflow-hidden rounded-full text-sm">
                    {reel.coachAvatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL
                      <img src={reel.coachAvatarUrl} alt="" className="size-full object-cover" />
                    ) : (
                      reel.coachDisplayName.charAt(0).toUpperCase()
                    )}
                  </span>
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
      ))}
    </div>
  );
}
