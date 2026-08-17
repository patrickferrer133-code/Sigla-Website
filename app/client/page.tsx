import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { getClientActiveProgramSessions, getClientProfileIdForUser } from "@/lib/logging/service";
import { listClientEngagementsForReview } from "@/lib/marketplace/service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ClientTodayPage() {
  const user = await requireRole("client");
  const clientId = await getClientProfileIdForUser(user.id);
  const [sessions, engagements] = clientId
    ? await Promise.all([getClientActiveProgramSessions(clientId), listClientEngagementsForReview(clientId)])
    : [[], []];
  const hasCoach = engagements.some((e) => e.status === "active" || e.status === "paused");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">Today</h1>

      {sessions.length === 0 ? (
        hasCoach ? (
          <div className="glass mt-6 rounded-2xl p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Your coach hasn&apos;t assigned a program yet. Send them a message if it&apos;s been a while.
            </p>
            <Button render={<Link href="/client/messages" />} nativeButton={false} className="mt-4 rounded-full" variant="outline">
              Message your coach
            </Button>
          </div>
        ) : (
          <div className="glass mt-6 rounded-2xl p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Your program, streak, and today&apos;s session will show up here once you have a coach and a plan.
            </p>
            <Button render={<Link href="/discover" />} nativeButton={false} className="mt-4 rounded-full">
              Find a coach
            </Button>
          </div>
        )
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">Pick a session to log.</p>
          {sessions.map((session) => (
            <Card key={session.sessionId}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  Week {session.weekNumber} — {session.sessionName}
                </CardTitle>
                <Button render={<Link href={`/client/sessions/${session.sessionId}`} />} nativeButton={false} size="sm">
                  Start
                </Button>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{session.exerciseCount} exercises</CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
