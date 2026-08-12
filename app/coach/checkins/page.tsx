import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { getCoachProfileIdForUser } from "@/lib/programs/service";
import { getAwaitingReplyCheckins } from "@/lib/checkins/service";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

export default async function CoachCheckinsPage() {
  const user = await requireRole("coach");
  const coachId = await getCoachProfileIdForUser(user.id);
  const items = coachId ? await getAwaitingReplyCheckins(coachId) : [];

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">Check-ins awaiting reply</h1>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Nothing waiting. You are caught up.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {items.map((item) => (
            <Link key={item.checkinId} href={`/coach/clients/${item.clientId}/checkins`}>
              <Card className="transition-colors hover:border-primary">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">{item.clientDisplayName}</CardTitle>
                  <span className="text-sm text-muted-foreground">Week of {item.weekOf}</span>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
