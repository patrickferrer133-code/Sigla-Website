import { requireRole } from "@/lib/auth/require-role";
import { getCoachProfileIdForUser } from "@/lib/programs/service";
import { listPackagesForOwner } from "@/lib/marketplace/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PackageForm } from "./package-form";
import { PublishToggle } from "./publish-toggle";
import { CompleteProfilePrompt } from "@/components/complete-profile-prompt";

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency }).format(cents / 100);
}

export default async function PackagesPage() {
  const user = await requireRole("coach");
  const coachId = await getCoachProfileIdForUser(user.id);
  if (!coachId) return <CompleteProfilePrompt />;

  const packages = await listPackagesForOwner(coachId);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">Packages</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Published packages appear on your public page and clients can apply to them.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        {packages.map((pkg) => (
          <Card key={pkg.id}>
            <CardHeader>
              <CardTitle className="flex items-baseline justify-between text-base">
                <span>{pkg.title}</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {formatPrice(pkg.priceCents, pkg.currency)} · {pkg.isPublished ? "Published" : "Draft"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <PackageForm
                packageId={pkg.id}
                defaults={{
                  title: pkg.title,
                  description: pkg.description,
                  priceCents: pkg.priceCents,
                  currency: pkg.currency,
                  billingPeriod: pkg.billingPeriod,
                  inclusions: pkg.inclusions,
                  slotLimit: pkg.slotLimit,
                }}
              />
              <PublishToggle packageId={pkg.id} isPublished={pkg.isPublished} />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">New package</CardTitle>
        </CardHeader>
        <CardContent>
          <PackageForm />
        </CardContent>
      </Card>
    </div>
  );
}
