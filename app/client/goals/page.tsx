import { requireRole } from "@/lib/auth/require-role";
import { getClientProfileIdForUser } from "@/lib/logging/service";
import { hasUnresolvedBlockingFlag, getLatestIntake } from "@/lib/intake/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GoalForm } from "./goal-form";
import Link from "next/link";
import { BackButton } from "@/components/back-button";

export default async function GoalsPage() {
  const user = await requireRole("client");
  const clientId = await getClientProfileIdForUser(user.id);
  if (!clientId) {
    return <p className="text-sm text-muted-foreground">Complete your account first.</p>;
  }

  const [intake, blocked] = await Promise.all([getLatestIntake(clientId), hasUnresolvedBlockingFlag(clientId)]);

  if (!intake) {
    return (
      <div className="mx-auto max-w-xl">
        <BackButton className="mb-4 self-start" />
        <h1 className="text-2xl font-semibold">Goals start after a quick health check</h1>
        <Link href="/client/intake" className="mt-4 inline-block text-sm text-primary underline underline-offset-4">
          Complete your intake
        </Link>
      </div>
    );
  }

  if (blocked) {
    return (
      <div className="mx-auto max-w-xl">
        <BackButton className="mb-4 self-start" />
        <h1 className="text-2xl font-semibold">Almost there</h1>
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">A quick doctor sign-off first</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Based on your health check, we&apos;d like a doctor to confirm it&apos;s safe to start before we set your
            plan. This is standard, it just makes your program safer. Your coach or support can help with next
            steps in the meantime.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <BackButton className="mb-4 self-start" />
      <h1 className="text-2xl font-semibold">Set your goal</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        We&apos;ll check it against a safe, realistic pace, no judgment either way.
      </p>
      <GoalForm />
    </div>
  );
}
