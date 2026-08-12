import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function MarketingHomePage() {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-4 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-primary/15 blur-3xl"
      />
      <h1 className="animate-in fade-in slide-in-from-bottom-4 duration-700 text-4xl font-semibold tracking-tight sm:text-5xl">
        Sigla
      </h1>
      <p className="animate-in fade-in slide-in-from-bottom-4 mt-4 max-w-xl text-balance text-muted-foreground duration-700 delay-150 fill-mode-both">
        The coaching platform where clients are not judged and coaches do not have to find clients alone.
      </p>
      <div className="animate-in fade-in slide-in-from-bottom-4 mt-8 flex flex-wrap items-center justify-center gap-3 duration-700 delay-300 fill-mode-both">
        <Button render={<Link href="/discover" />} nativeButton={false}>
          Find a coach
        </Button>
        <Button render={<Link href="/sign-up" />} nativeButton={false} variant="outline">
          Become a coach
        </Button>
      </div>
    </div>
  );
}
