import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCoachProfileIdForUser } from "@/lib/programs/service";
import { db } from "@/lib/db/client";
import { coachProfiles } from "@/lib/db/schema/identity";
import { eq } from "drizzle-orm";
import { AmbientBackground } from "@/components/ambient-background";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AvatarForm } from "./avatar-form";
import { NameForm } from "./name-form";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  let coachHandle: string | null = null;
  if (user.role === "coach") {
    const coachId = await getCoachProfileIdForUser(user.id);
    if (coachId) {
      const [row] = await db.select({ handle: coachProfiles.handle }).from(coachProfiles).where(eq(coachProfiles.id, coachId)).limit(1);
      coachHandle = row?.handle ?? null;
    }
  }

  return (
    <div className="relative min-h-svh">
      <AmbientBackground />
      <div className="mx-auto max-w-md px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-lg">Your profile</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <AvatarForm avatarUrl={user.avatarUrl ?? null} displayName={user.displayName} />
            <NameForm displayName={user.displayName} />
            <div className="text-sm text-muted-foreground">
              <p>Email: {user.email}</p>
              <p className="mt-1 capitalize">Account type: {user.role}</p>
            </div>

            <div className="flex flex-col gap-2 border-t pt-4 text-sm">
              {user.role === "coach" && coachHandle && (
                <Link href={`/c/${coachHandle}`} className="text-primary underline underline-offset-4">
                  View your public page
                </Link>
              )}
              {user.role === "coach" && (
                <Link href="/coach/settings" className="text-primary underline underline-offset-4">
                  Edit coaching profile (bio, specialties, packages)
                </Link>
              )}
              {user.role === "client" && (
                <Link href="/client/coach" className="text-primary underline underline-offset-4">
                  Your coaching history
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
