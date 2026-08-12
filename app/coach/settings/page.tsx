import { requireRole } from "@/lib/auth/require-role";
import { getCoachProfileIdForUser } from "@/lib/programs/service";
import { getCoachProfileForOwner } from "@/lib/marketplace/service";
import { SettingsForm } from "./settings-form";

export default async function CoachSettingsPage() {
  const user = await requireRole("coach");
  const coachId = await getCoachProfileIdForUser(user.id);
  if (!coachId) return <p className="text-sm text-muted-foreground">Complete your coach profile first.</p>;

  const profile = await getCoachProfileForOwner(coachId);
  if (!profile) return <p className="text-sm text-muted-foreground">Complete your coach profile first.</p>;

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold">Profile settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">This is what clients see on your public page.</p>

      <div className="mt-6">
        <SettingsForm defaults={profile} />
      </div>
    </div>
  );
}
