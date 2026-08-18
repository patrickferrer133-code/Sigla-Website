import { requireRole } from "@/lib/auth/require-role";
import { getCoachProfileIdForUser } from "@/lib/programs/service";
import { getCoachProfileForOwner } from "@/lib/marketplace/service";
import { CompleteProfilePrompt } from "@/components/complete-profile-prompt";
import { SettingsForm } from "./settings-form";
import { CoverPhotoForm } from "./cover-photo-form";

export default async function CoachSettingsPage() {
  const user = await requireRole("coach");
  const coachId = await getCoachProfileIdForUser(user.id);
  if (!coachId) return <CompleteProfilePrompt />;

  const profile = await getCoachProfileForOwner(coachId);
  if (!profile) return <CompleteProfilePrompt />;

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold">Profile settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">This is what clients see on your public page.</p>

      <div className="mt-6">
        <CoverPhotoForm coverPhotoUrl={profile.coverPhotoUrl} />
      </div>

      <div className="mt-6">
        <SettingsForm defaults={profile} />
      </div>
    </div>
  );
}
