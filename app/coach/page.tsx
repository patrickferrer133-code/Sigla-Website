import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { getCoachProfileIdForUser } from "@/lib/programs/service";
import { getCoachAlertQueue } from "@/lib/alerts/service";
import type { AlertKind } from "@/lib/domain/alerts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Priority order matches docs/08 section 2 — weeks_3_to_6_churn_risk
// outranks everything else, it's the highest-leverage retention signal.
const ALERT_PRIORITY: AlertKind[] = [
  "weeks_3_to_6_churn_risk",
  "pain_reported",
  "missed_sessions",
  "gone_quiet",
  "checkin_missed",
  "stalled_progress",
  "overreaching",
  "renewal_risk",
];

const ALERT_LABELS: Record<AlertKind, string> = {
  weeks_3_to_6_churn_risk: "At risk of quitting",
  pain_reported: "Reported pain",
  missed_sessions: "Missed sessions",
  gone_quiet: "Gone quiet",
  checkin_missed: "Check-in missed",
  stalled_progress: "Progress stalled",
  overreaching: "Overreaching",
  renewal_risk: "Renewal risk",
};

export default async function CoachDashboardPage() {
  const user = await requireRole("coach");
  const coachId = await getCoachProfileIdForUser(user.id);
  const queue = coachId ? await getCoachAlertQueue(coachId) : [];

  const flagged = queue
    .filter((item) => item.alerts.length > 0)
    .map((item) => ({ ...item, topPriority: Math.min(...item.alerts.map((a) => ALERT_PRIORITY.indexOf(a.kind))) }))
    .sort((a, b) => a.topPriority - b.topPriority);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">Clients who need you first, ranked by risk.</p>

      {flagged.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">Nothing waiting. Every active client looks on track.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {flagged.map((item) => (
            <Link key={item.engagementId} href={`/coach/clients/${item.clientId}/checkins`}>
              <Card className="transition-colors hover:border-primary">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">{item.clientDisplayName}</CardTitle>
                  <div className="flex gap-1">
                    {item.alerts.map((a) => (
                      <Badge key={a.kind} variant={a.kind === "weeks_3_to_6_churn_risk" || a.kind === "pain_reported" ? "default" : "secondary"}>
                        {ALERT_LABELS[a.kind]}
                      </Badge>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{item.alerts[0].reason}</CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
