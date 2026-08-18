import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { searchCoaches } from "@/lib/marketplace/service";
import { db } from "@/lib/db/client";
import { coachProfiles } from "@/lib/db/schema/identity";
import { sql } from "drizzle-orm";

const STEPS = [
  {
    n: "01",
    title: "Find a coach who gets it",
    body: "Filter by goal, specialty, and mode. See real reviews, real packages, no black box.",
  },
  {
    n: "02",
    title: "Apply, get accepted",
    body: "Send an application, hear back, and start with an intake built to catch real risk, not busywork.",
  },
  {
    n: "03",
    title: "Train, check in, keep going",
    body: "Weekly check-ins, a coach who replies, and a community that doesn't judge a bad week.",
  },
];

const FEATURES = [
  {
    title: "Judgement-free, by design",
    body: "Anonymous posting in community spaces. No before-and-afters without consent. No calorie shaming, ever.",
  },
  {
    title: "A realism engine, not a guessing game",
    body: "Goals get checked against your actual numbers before a coach commits to them — including a hard floor no one can override.",
  },
  {
    title: "Built for a real coaching business",
    body: "Program builder, check-in triage, content tooling, and a client roster that doesn't fall over at client 26.",
  },
];

function formatSpecialty(s: string) {
  return s.replace(/_/g, " ");
}

const FOUNDING_COACH_THRESHOLD = 25;

export default async function MarketingHomePage() {
  const [coaches, [{ coachCount }]] = await Promise.all([
    searchCoaches({}),
    db.select({ coachCount: sql<number>`count(*)::int` }).from(coachProfiles),
  ]);
  const featured = coaches.slice(0, 6);
  const isEarlyStage = coachCount < FOUNDING_COACH_THRESHOLD;

  return (
    <div className="relative flex min-h-svh flex-col overflow-x-hidden">
      {/* Ambient gradient mesh background */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-background" />
        <div className="animate-mesh-drift absolute -top-40 -left-40 h-[42rem] w-[42rem] rounded-full bg-primary/25 blur-[100px]" />
        <div className="animate-float-slower absolute top-1/3 -right-32 h-[36rem] w-[36rem] rounded-full bg-[oklch(0.72_0.16_65)]/20 blur-[100px]" />
        <div className="animate-float-slow absolute bottom-0 left-1/4 h-[30rem] w-[30rem] rounded-full bg-[oklch(0.6_0.2_30)]/15 blur-[100px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,var(--foreground)_1px,transparent_0)] opacity-[0.03] [background-size:28px_28px]" />
      </div>

      {/* Nav */}
      <header className="sticky top-0 z-20 px-4 pt-4">
        <nav className="glass mx-auto flex max-w-5xl items-center justify-between rounded-full px-5 py-3 shadow-sm">
          <Logo className="h-7" glow />
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/discover" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">
              Discover
            </Link>
            <Link href="/reels" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">
              Reels
            </Link>
            <Button render={<Link href="/sign-in" />} nativeButton={false} variant="ghost" size="sm">
              Sign in
            </Button>
            <Button render={<Link href="/sign-up" />} nativeButton={false} size="sm">
              Get started
            </Button>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="flex flex-col items-center px-4 pt-20 pb-16 text-center sm:pt-28">
        <div className="animate-in fade-in slide-in-from-bottom-4 glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-muted-foreground duration-700">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
          </span>
          {isEarlyStage ? "Now accepting founding coaches" : `${coachCount}+ coaches already on Sigla`}
        </div>

        <h1 className="animate-in fade-in slide-in-from-bottom-4 mt-6 max-w-3xl text-5xl font-semibold tracking-tight text-balance duration-700 sm:text-7xl">
          Coaching, without the{" "}
          <span className="text-gradient animate-gradient">guesswork</span>
        </h1>
        <p className="animate-in fade-in slide-in-from-bottom-4 mt-5 max-w-xl text-balance text-lg text-muted-foreground duration-700 delay-150 fill-mode-both">
          The platform where clients are not judged and coaches do not have to find clients alone.
        </p>
        <div className="animate-in fade-in slide-in-from-bottom-4 mt-8 flex flex-wrap items-center justify-center gap-3 duration-700 delay-300 fill-mode-both">
          <Button render={<Link href="/discover" />} nativeButton={false} size="lg" className="rounded-full px-6 text-base">
            Find a coach
          </Button>
          <Button render={<Link href="/sign-up" />} nativeButton={false} variant="outline" size="lg" className="rounded-full px-6 text-base">
            Become a coach
          </Button>
        </div>
      </section>

      {/* Founding coach callout — shown honestly while the roster is small */}
      {isEarlyStage && (
        <section className="animate-in fade-in duration-1000 delay-500 fill-mode-both border-y border-border/50 bg-muted/30 px-4 py-12">
          <div className="glass-strong mx-auto flex max-w-3xl flex-col items-center gap-3 rounded-3xl p-8 text-center">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">Founding coach spots open</span>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Be one of Sigla&apos;s first coaches</h2>
            <p className="max-w-lg text-balance text-sm text-muted-foreground">
              We just launched. The first {FOUNDING_COACH_THRESHOLD} coaches to join get a Founding Coach badge on
              their profile, first pick of visibility as we grow, and a direct line to us for shaping what gets built next.
            </p>
            <Button render={<Link href="/sign-up" />} nativeButton={false} className="mt-2 rounded-full px-6 text-base">
              Claim your spot
            </Button>
          </div>
        </section>
      )}

      {/* Featured coaches marquee */}
      {featured.length > 0 && (
        <section className="animate-in fade-in duration-1000 delay-500 fill-mode-both border-y border-border/50 bg-muted/30 py-8">
          <div className="mx-auto max-w-6xl overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
            <div className="animate-marquee flex w-max gap-4">
              {[...featured, ...featured].map((coach, i) => (
                <Link
                  key={`${coach.handle}-${i}`}
                  href={`/c/${coach.handle}`}
                  className="glass flex w-72 shrink-0 flex-col gap-2 rounded-2xl p-4 transition-transform hover:-translate-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{coach.displayName}</span>
                    {coach.ratingCount > 0 && (
                      <span className="text-xs text-muted-foreground">{coach.ratingAvg} ★</span>
                    )}
                  </div>
                  <p className="line-clamp-1 text-sm text-muted-foreground">{coach.headline}</p>
                  {coach.specialties && coach.specialties.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {coach.specialties.slice(0, 2).map((s) => (
                        <span key={s} className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.7rem] text-primary">
                          {formatSpecialty(s)}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="mx-auto w-full max-w-5xl px-4 py-24">
        <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">How it works</h2>
        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.n} className="glass group relative overflow-hidden rounded-3xl p-6 transition-transform hover:-translate-y-1">
              <span className="text-gradient text-4xl font-bold opacity-40 transition-opacity group-hover:opacity-70">{step.n}</span>
              <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature grid */}
      <section className="relative mx-auto w-full max-w-5xl px-4 py-24">
        <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">Built differently, on purpose</h2>
        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="glass-strong rounded-3xl p-6">
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 pb-24">
        <div className="animate-gradient relative mx-auto max-w-4xl overflow-hidden rounded-[2.5rem] bg-[linear-gradient(120deg,var(--primary),var(--chart-2),var(--chart-4),var(--primary))] bg-[length:300%_300%] px-8 py-16 text-center shadow-2xl shadow-primary/20">
          <div aria-hidden className="animate-shimmer absolute inset-0 bg-[linear-gradient(110deg,transparent_40%,rgba(255,255,255,0.25)_50%,transparent_60%)]" />
          <h2 className="relative text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Ready to stop guessing?
          </h2>
          <p className="relative mx-auto mt-3 max-w-md text-balance text-white/90">
            Whether you&apos;re looking for a coach or building your coaching business, Sigla is free to start.
          </p>
          <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button render={<Link href="/discover" />} nativeButton={false} size="lg" className="rounded-full bg-white px-6 text-base text-[var(--primary)] hover:bg-white/90">
              Find a coach
            </Button>
            <Button render={<Link href="/sign-up" />} nativeButton={false} size="lg" variant="outline" className="rounded-full border-white/40 bg-white/10 px-6 text-base text-white hover:bg-white/20">
              Become a coach
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/50 px-4 py-8 text-center text-sm text-muted-foreground">
        Sigla — coaching, without the guesswork.
      </footer>
    </div>
  );
}
