import Link from "next/link";
import { Button } from "@/components/ui/button";

export function CompleteProfilePrompt() {
  return (
    <div className="glass mx-auto max-w-md rounded-3xl p-6 text-center">
      <h2 className="text-lg font-semibold">One quick step first</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Your coach profile isn&apos;t set up yet — it only takes a minute, and everything else on Sigla unlocks once it&apos;s done.
      </p>
      <Button render={<Link href="/onboarding" />} nativeButton={false} className="mt-4 rounded-full">
        Complete my profile
      </Button>
    </div>
  );
}
