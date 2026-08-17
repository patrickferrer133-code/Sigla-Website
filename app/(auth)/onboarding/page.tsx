import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCoachProfileIdForUser } from "@/lib/programs/service";
import { getClientProfileIdForUser } from "@/lib/logging/service";
import { ClientOnboardingForm } from "./client-onboarding-form";
import { CoachOnboardingForm } from "./coach-onboarding-form";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  if (user.role === "coach") {
    const coachId = await getCoachProfileIdForUser(user.id);
    if (coachId) redirect("/coach");
  } else if (user.role === "client") {
    const clientId = await getClientProfileIdForUser(user.id);
    if (clientId) redirect("/client");
  } else {
    redirect("/admin");
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-xl font-semibold">Welcome to Sigla, {user.displayName}.</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {user.role === "coach"
          ? "A few details to set up your public page."
          : "A few details so your coach can build a plan around your real life."}
      </p>
      <div className="mt-6">
        {user.role === "coach" ? <CoachOnboardingForm /> : <ClientOnboardingForm />}
      </div>
    </div>
  );
}
