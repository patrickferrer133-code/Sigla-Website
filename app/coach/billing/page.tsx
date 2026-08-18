import { requireRole } from "@/lib/auth/require-role";
import { getCoachProfileIdForUser } from "@/lib/programs/service";
import { getBillingSummaryForCoach, getPhMonthlyPlanPrices } from "@/lib/billing/service";
import { isUpgradeFrom, planCodeForTier, type CoachTierCode } from "@/lib/domain/billing-webhook";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompleteProfilePrompt } from "@/components/complete-profile-prompt";
import { UpgradeButton } from "./upgrade-button";

const TIERS = [
  { tier: "free", label: "Starter" },
  { tier: "pro", label: "Pro" },
  { tier: "premium", label: "Premium" },
] as const satisfies readonly { tier: CoachTierCode; label: string }[];

function formatClients(n: number | "unlimited") {
  return n === "unlimited" ? "Unlimited" : String(n);
}

// Integer centavos in, display string out. The division happens here at the
// display layer only, never in storage or in anything sent to PayMongo.
function formatMoney(amountCents: number, currency: string) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amountCents / 100);
}

export default async function CoachBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const user = await requireRole("coach");
  const coachId = await getCoachProfileIdForUser(user.id);
  if (!coachId) return <CompleteProfilePrompt />;

  const [summary, prices, params] = await Promise.all([
    getBillingSummaryForCoach(coachId),
    getPhMonthlyPlanPrices(),
    searchParams,
  ]);
  const currentTier = summary.tier as CoachTierCode;
  const currentLabel = TIERS.find((t) => t.tier === currentTier)?.label ?? "Starter";

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">Plan and billing</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        You&apos;re on {currentLabel}. {formatClients(summary.activeClients)} of{" "}
        {formatClients(summary.entitlements.maxActiveClients)} active client slots used.
      </p>

      {params.checkout === "success" && (
        <p className="mt-4 rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
          Payment received. Your plan updates within a minute of your bank or wallet confirming, so
          refresh this page if it still shows the old plan.
        </p>
      )}
      {params.checkout === "canceled" && (
        <p className="mt-4 rounded-md border p-3 text-sm text-muted-foreground">
          Checkout was cancelled. Nothing was charged.
        </p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {TIERS.map((tier) => {
          const price = prices[planCodeForTier(tier.tier)];
          const isCurrent = tier.tier === currentTier;
          // Free/Starter is the default tier and never needs a checkout.
          const canUpgrade = tier.tier !== "free" && isUpgradeFrom(currentTier, tier.tier);

          return (
            <Card key={tier.tier} className={isCurrent ? "border-primary" : ""}>
              <CardHeader>
                <CardTitle className="text-base">{tier.label}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {price ? `${formatMoney(price.amountCents, price.currency)} / month` : "Free"}
                </p>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {isCurrent && <p className="font-medium text-primary">Current plan</p>}
                {canUpgrade && (
                  <UpgradeButton
                    planCode={tier.tier === "pro" ? "pro" : "premium"}
                    label={`Upgrade to ${tier.label}`}
                  />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">How billing works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Upgrades are charged monthly in pesos through GCash, Maya, GrabPay, or card. You&apos;ll
            get a receipt by email.
          </p>
          <p>
            To downgrade or cancel, email support@sigla.app and we&apos;ll action it before your next
            billing date.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
