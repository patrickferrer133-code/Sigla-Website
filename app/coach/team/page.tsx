import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { getCoachProfileIdForUser } from "@/lib/programs/service";
import { getBillingSummaryForCoach } from "@/lib/billing/service";
import { listTeamMembers, listCoachesAssistedByUser } from "@/lib/team/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InviteForm } from "./invite-form";
import { removeTeamMemberAction } from "./actions";
import { CompleteProfilePrompt } from "@/components/complete-profile-prompt";

export default async function TeamPage() {
  const user = await requireRole("coach");
  const coachId = await getCoachProfileIdForUser(user.id);
  if (!coachId) return <CompleteProfilePrompt />;

  const [summary, members, assisting] = await Promise.all([
    getBillingSummaryForCoach(coachId),
    listTeamMembers(coachId),
    listCoachesAssistedByUser(user.id),
  ]);

  const seatLimit = summary.entitlements.assistantSeats;

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold">Team</h1>

      {seatLimit === 0 ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Assistant seats are a Premium feature</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Upgrade to add assistants who can help manage check-ins and messages for your clients.{" "}
            <Link href="/coach/billing" className="text-primary underline underline-offset-4">See plans</Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            {members.length} of {seatLimit} assistant seats used.
          </p>
          <div className="mt-6">
            <InviteForm />
          </div>
          <div className="mt-6 flex flex-col gap-3">
            {members.map((member) => (
              <Card key={member.id}>
                <CardContent className="flex items-center justify-between py-4 text-sm">
                  <div>
                    <p className="font-medium">{member.displayName}</p>
                    <p className="text-muted-foreground">{member.email}</p>
                  </div>
                  <form action={removeTeamMemberAction.bind(null, member.id)}>
                    <Button type="submit" variant="ghost" size="sm">Remove</Button>
                  </form>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {assisting.length > 0 && (
        <>
          <h2 className="mt-10 text-lg font-semibold">You assist</h2>
          <div className="mt-3 flex flex-col gap-3">
            {assisting.map((row) => (
              <Card key={row.ownerCoachId}>
                <CardContent className="flex items-center justify-between py-4 text-sm">
                  <div>
                    <p className="font-medium">{row.displayName}</p>
                    <p className="text-muted-foreground">@{row.handle}</p>
                  </div>
                  <Link href={`/coach/checkins?as=${row.ownerCoachId}`} className="text-primary underline underline-offset-4">
                    View their check-ins
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
