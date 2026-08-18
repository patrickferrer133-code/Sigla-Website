import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { getClientProfileIdForUser } from "@/lib/logging/service";
import { getCurrentWeekCheckin } from "@/lib/checkins/service";
import { addDaysToIsoDate } from "@/lib/domain/checkins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckinForm } from "./checkin-form";
import { BackButton } from "@/components/back-button";

export default async function CheckInPage() {
  const user = await requireRole("client");
  const clientId = await getClientProfileIdForUser(user.id);
  if (!clientId) {
    return <EmptyState />;
  }

  const result = await getCurrentWeekCheckin(clientId);
  if (!result.ok) {
    return <EmptyState />;
  }

  const { checkin, weekOf, todayIsoDate, edRiskFlagged, dailyWeightsKg } = result.data;
  const dayLabels = Array.from({ length: 7 }, (_, i) => addDaysToIsoDate(weekOf, i));

  if (checkin && !checkin.editable) {
    return (
      <div className="mx-auto max-w-xl">
        <BackButton className="mb-4 self-start" />
        <h1 className="text-2xl font-semibold">This week is closed</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your coach already replied to this week&apos;s check-in. Message them in chat for anything else.
        </p>
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Coach reply</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm">{checkin.coachReply}</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <BackButton className="mb-4 self-start" />
      <h1 className="text-2xl font-semibold">This week&apos;s check-in</h1>
      <p className="mt-1 text-sm text-muted-foreground">Everything here is optional. Fill in what you have.</p>
      <CheckinForm
        weekOf={weekOf}
        dayLabels={dayLabels}
        todayIsoDate={todayIsoDate}
        existing={checkin}
        edRiskFlagged={edRiskFlagged}
        dailyWeightsKg={dailyWeightsKg}
      />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-xl">
      <BackButton className="mb-4 self-start" />
      <h1 className="text-2xl font-semibold">Check-ins start with a coach</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Weekly check-ins show up here once you have an active coach and plan.
      </p>
      <Link href="/discover" className="mt-4 inline-block text-sm text-primary underline underline-offset-4">
        Find a coach
      </Link>
    </div>
  );
}
