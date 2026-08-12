import { requireRole } from "@/lib/auth/require-role";
import { getCoachProfileIdForUser } from "@/lib/programs/service";
import { listApplicationsForCoach } from "@/lib/marketplace/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { respondToApplicationAction } from "./actions";

export default async function ApplicationsPage() {
  const user = await requireRole("coach");
  const coachId = await getCoachProfileIdForUser(user.id);
  if (!coachId) return <p className="text-sm text-muted-foreground">Complete your coach profile first.</p>;

  const applications = await listApplicationsForCoach(coachId);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">Applications</h1>
      <p className="mt-1 text-sm text-muted-foreground">Clients who applied to your packages.</p>

      {applications.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">No pending applications.</p>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {applications.map((app) => (
          <Card key={app.engagementId}>
            <CardHeader>
              <CardTitle className="text-base">{app.clientDisplayName}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{app.packageTitle ?? "No package selected"}</span>
              <div className="flex gap-2">
                <form action={respondToApplicationAction.bind(null, app.engagementId, "decline")}>
                  <Button type="submit" variant="ghost" size="sm">Decline</Button>
                </form>
                <form action={respondToApplicationAction.bind(null, app.engagementId, "accept")}>
                  <Button type="submit" size="sm">Accept</Button>
                </form>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
