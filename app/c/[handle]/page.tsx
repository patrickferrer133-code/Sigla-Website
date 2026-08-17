import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCoachPublicProfile } from "@/lib/marketplace/service";
import { listPublicPostsForCoach } from "@/lib/content/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AmbientBackground } from "@/components/ambient-background";
import { PostMediaDisplay } from "@/components/post-media";
import { ApplyButton } from "./apply-button";

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency }).format(cents / 100);
}

function billingLabel(period: string) {
  return { one_time: "one-time", monthly: "/month", quarterly: "/quarter", per_12_weeks: "/12 weeks" }[period] ?? period;
}

export default async function CoachPublicPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const profile = await getCoachPublicProfile(handle);
  if (!profile) notFound();

  const { coach, packages, reviews } = profile;
  const [user, posts] = await Promise.all([getCurrentUser(), listPublicPostsForCoach(coach.id)]);

  return (
    <div className="relative min-h-svh">
      <AmbientBackground />
      <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="glass-strong flex items-start justify-between gap-4 rounded-3xl p-6 shadow-sm">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{coach.displayName}</h1>
          <p className="text-sm text-muted-foreground">@{coach.handle}</p>
        </div>
        {coach.verificationStatus === "verified" && (
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">Verified</span>
        )}
      </div>

      {coach.headline && <p className="mt-3 text-base">{coach.headline}</p>}

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {coach.city && <span>{[coach.city, coach.country].filter(Boolean).join(", ")}</span>}
        {coach.yearsExperience != null && <span>{coach.yearsExperience} years coaching</span>}
        {coach.ratingCount > 0 && <span>{coach.ratingAvg} ★ ({coach.ratingCount})</span>}
      </div>

      {coach.specialties && coach.specialties.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {coach.specialties.map((s) => (
            <span key={s} className="rounded-full border px-2.5 py-0.5 text-xs">{s.replace(/_/g, " ")}</span>
          ))}
        </div>
      )}

      {coach.bio && <p className="mt-6 whitespace-pre-line text-sm leading-relaxed">{coach.bio}</p>}

      {!coach.acceptingClients && (
        <p className="mt-6 text-sm text-muted-foreground">This coach isn&apos;t accepting new clients right now.</p>
      )}

      {packages.length > 0 && (
        <div className="mt-10 flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Packages</h2>
          {packages.map((pkg) => (
            <Card key={pkg.id}>
              <CardHeader>
                <CardTitle className="flex items-baseline justify-between text-base">
                  <span>{pkg.title}</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    {formatPrice(pkg.priceCents, pkg.currency)} {billingLabel(pkg.billingPeriod)}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                {pkg.trialDays && (
                  <span className="w-fit rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    {pkg.trialDays}-day free trial
                  </span>
                )}
                {pkg.description && <p className="text-muted-foreground">{pkg.description}</p>}
                {pkg.inclusions && pkg.inclusions.length > 0 && (
                  <ul className="list-inside list-disc text-muted-foreground">
                    {pkg.inclusions.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                )}
                {coach.acceptingClients && (
                  user?.role === "client" ? (
                    <ApplyButton packageId={pkg.id} />
                  ) : (
                    <Link href={`/sign-in?next=/c/${coach.handle}`} className="w-fit text-sm text-primary underline underline-offset-4">
                      Sign in as a client to apply
                    </Link>
                  )
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {posts.length > 0 && (
        <div className="mt-10 flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Posts</h2>
          {posts.map((post) => (
            <div key={post.id} className="flex flex-col gap-2 border-b pb-4 text-sm last:border-0">
              <div className="flex items-baseline justify-between">
                <span className="font-medium">{post.title}</span>
                <span className="text-xs text-muted-foreground">{post.kind?.replace(/_/g, " ")}</span>
              </div>
              <PostMediaDisplay media={post.media} />
              <p className="whitespace-pre-line text-muted-foreground">{post.bodyMd}</p>
            </div>
          ))}
        </div>
      )}

      {reviews.length > 0 && (
        <div className="mt-10 flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Reviews</h2>
          {reviews.map((review) => (
            <div key={review.id} className="border-b pb-4 text-sm last:border-0">
              <div className="flex items-baseline justify-between">
                <span className="font-medium">{review.clientDisplayName}</span>
                <span className="text-muted-foreground">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
              </div>
              {review.body && <p className="mt-1 text-muted-foreground">{review.body}</p>}
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
