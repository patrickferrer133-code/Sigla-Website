import { requireRole } from "@/lib/auth/require-role";
import { getCoachProfileIdForUser } from "@/lib/programs/service";
import { getBillingSummaryForCoach } from "@/lib/billing/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TIERS = [
  { code: "free", label: "Starter", price: "₱0 / month" },
  { code: "pro", label: "Pro", price: "₱990 / month" },
  { code: "premium", label: "Premium", price: "₱2,490 / month" },
] as const;

function formatClients(n: number | "unlimited") {
  return n === "unlimited" ? "Unlimited" : String(n);
}

export default async function CoachBillingPage() {
  const user = await requireRole("coach");
  const coachId = await getCoachProfileIdForUser(user.id);
  if (!coachId) return <p className="text-sm text-muted-foreground">Complete your coach profile first.</p>;

  const summary = await getBillingSummaryForCoach(coachId);
  const currentLabel = TIERS.find((t) => t.code === summary.tier)?.label ?? "Starter";

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">Plan and billing</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        You&apos;re on {currentLabel}. {formatClients(summary.activeClients)} of{" "}
        {formatClients(summary.entitlements.maxActiveClients)} active client slots used.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {TIERS.map((tier) => (
          <Card key={tier.code} className={tier.code === summary.tier ? "border-primary" : ""}>
            <CardHeader>
              <CardTitle className="text-base">{tier.label}</CardTitle>
              <p className="text-sm text-muted-foreground">{tier.price}</p>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {tier.code === summary.tier && <p className="font-medium text-primary">Current plan</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">Want to change plans?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Payments aren&apos;t automated yet. Email support@sigla.app with the plan you want — we&apos;ll confirm payment
          off-platform (GCash or bank transfer) and switch your plan the same day.
        </CardContent>
      </Card>
    </div>
  );
}
