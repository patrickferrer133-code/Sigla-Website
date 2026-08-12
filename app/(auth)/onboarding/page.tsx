import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  return (
    <div className="text-center">
      <h1 className="text-xl font-semibold">Welcome to Sigla, {user.displayName}.</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Onboarding for {user.role}s is coming in a later phase. For now, head to your dashboard.
      </p>
    </div>
  );
}
