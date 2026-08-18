import { requireRole } from "@/lib/auth/require-role";
import { listCoachesWithTierInfo } from "@/lib/billing/service";
import { getEntitlementsForTier } from "@/lib/billing/entitlements";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { setCoachTierAction } from "./actions";
import { BackButton } from "@/components/back-button";

const TIERS = [
  { code: "free", label: "Starter" },
  { code: "pro", label: "Pro" },
  { code: "premium", label: "Premium" },
] as const;

export default async function AdminCoachesPage() {
  await requireRole("admin");
  const coaches = await listCoachesWithTierInfo();

  return (
    <div className="mx-auto max-w-2xl">
      <BackButton className="mb-4 self-start" />
      <h1 className="text-2xl font-semibold">Coaches</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Set a coach&apos;s plan once their off-platform payment is confirmed.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {coaches.map((coach) => {
          const limit = getEntitlementsForTier(coach.tier as "free" | "pro" | "premium").maxActiveClients;
          return (
            <Card key={coach.coachId}>
              <CardHeader>
                <CardTitle className="flex items-baseline justify-between text-base">
                  <span>{coach.displayName}</span>
                  <span className="text-xs font-normal text-muted-foreground">@{coach.handle}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {coach.activeClients} / {limit === "unlimited" ? "∞" : limit} active clients
                </span>
                <div className="flex gap-2">
                  {TIERS.map((tier) => (
                    <form key={tier.code} action={setCoachTierAction.bind(null, coach.coachId, tier.code)}>
                      <Button type="submit" size="sm" variant={coach.tier === tier.code ? "default" : "ghost"}>
                        {tier.label}
                      </Button>
                    </form>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
