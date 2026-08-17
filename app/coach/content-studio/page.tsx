import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { getCoachProfileIdForUser } from "@/lib/programs/service";
import { getBillingSummaryForCoach } from "@/lib/billing/service";
import { hasContentStudioAccess } from "@/lib/billing/entitlements";
import { HOOK_LIBRARY } from "@/lib/content-studio/hooks-library";
import { SCRIPT_TEMPLATES } from "@/lib/content-studio/script-templates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CATEGORY_LABEL: Record<string, string> = {
  pain_point: "Pain point",
  myth_bust: "Myth bust",
  social_proof: "Social proof",
  curiosity: "Curiosity",
  relatable: "Relatable",
  education: "Education",
  case_study: "Case study",
  behind_the_scenes: "Behind the scenes",
};

export default async function ContentStudioPage() {
  const user = await requireRole("coach");
  const coachId = await getCoachProfileIdForUser(user.id);
  if (!coachId) return <p className="text-sm text-muted-foreground">Complete your coach profile first.</p>;

  const summary = await getBillingSummaryForCoach(coachId);
  const hasScriptAccess = hasContentStudioAccess(summary.tier, "standard");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">Content Studio</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Content is upstream of everything else — start here before the funnel.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Hook library</h2>
      <div className="mt-3 flex flex-col gap-2">
        {HOOK_LIBRARY.map((hook) => (
          <div key={hook.id} className="flex items-baseline justify-between rounded-md border p-3 text-sm">
            <span>{hook.text}</span>
            <span className="ml-3 shrink-0 text-xs text-muted-foreground">{CATEGORY_LABEL[hook.category]}</span>
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-lg font-semibold">Script templates</h2>
      {!hasScriptAccess ? (
        <Card className="mt-3">
          <CardHeader>
            <CardTitle className="text-base">Upgrade to Pro to unlock script templates</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Structured short-form scripts for case studies, myth-busts, and education content.{" "}
            <Link href="/coach/billing" className="text-primary underline underline-offset-4">See plans</Link>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-3 flex flex-col gap-4">
          {SCRIPT_TEMPLATES.map((script) => (
            <Card key={script.id}>
              <CardHeader>
                <CardTitle className="flex items-baseline justify-between text-base">
                  <span>{script.title}</span>
                  <span className="text-xs font-normal text-muted-foreground">{CATEGORY_LABEL[script.pillar]}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                {script.structure.map((beat) => (
                  <div key={beat.label}>
                    <span className="font-medium">{beat.label}: </span>
                    <span className="text-muted-foreground">{beat.prompt}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
