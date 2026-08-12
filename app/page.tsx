import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function MarketingHomePage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-4 text-center">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Sigla</h1>
      <p className="mt-4 max-w-xl text-balance text-muted-foreground">
        The coaching platform where clients are not judged and coaches do not have to find clients alone.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
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
