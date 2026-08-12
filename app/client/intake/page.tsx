import { requireRole } from "@/lib/auth/require-role";
import { IntakeForm } from "./intake-form";

export default async function IntakePage() {
  await requireRole("client");

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold">Let&apos;s get to know you</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        A few minutes now means a plan built for your real life, not a generic template.
      </p>
      <IntakeForm />
    </div>
  );
}
