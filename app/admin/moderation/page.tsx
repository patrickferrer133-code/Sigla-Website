import { requireRole } from "@/lib/auth/require-role";
import { listOpenReports, getReportedContentBody } from "@/lib/community/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { resolveReportAction } from "./actions";
import { BackButton } from "@/components/back-button";

const REASON_LABEL: Record<string, string> = {
  restriction_content: "Restriction / disordered eating content",
  body_shaming: "Body shaming",
  harassment: "Harassment",
  medical_advice: "Unqualified medical advice",
  selling_or_poaching: "Selling or poaching",
  self_harm_risk: "Possible self-harm risk",
  other: "Other",
};

export default async function ModerationQueuePage() {
  await requireRole("admin");

  const reports = await listOpenReports();
  const reportsWithContent = await Promise.all(
    reports.map(async (report) => ({ report, body: await getReportedContentBody(report.targetType, report.targetId) })),
  );

  return (
    <div className="mx-auto max-w-2xl">
      <BackButton className="mb-4 self-start" />
      <h1 className="text-2xl font-semibold">Moderation queue</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Reports never auto-delete content. Every item here is waiting on a human decision.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        {reportsWithContent.map(({ report, body }) => (
          <Card key={report.id} className={report.reason === "self_harm_risk" ? "border-destructive/60 bg-destructive/5" : ""}>
            <CardHeader>
              <CardTitle className="flex items-baseline justify-between text-base">
                <span>{REASON_LABEL[report.reason] ?? report.reason}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {report.targetType.replace("community_", "")} · {report.source === "auto_flag" ? "auto-flagged" : "reported by a member"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <p className="whitespace-pre-line rounded-md border bg-background p-3 text-muted-foreground">
                {body ?? "(content no longer available)"}
              </p>
              <div className="flex gap-2">
                <form action={resolveReportAction.bind(null, report.id, "dismissed")}>
                  <Button type="submit" variant="ghost" size="sm">Dismiss</Button>
                </form>
                <form action={resolveReportAction.bind(null, report.id, "actioned")}>
                  <Button type="submit" size="sm">Mark actioned</Button>
                </form>
              </div>
            </CardContent>
          </Card>
        ))}
        {reportsWithContent.length === 0 && <p className="text-sm text-muted-foreground">Queue is empty.</p>}
      </div>
    </div>
  );
}
