"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { startCheckoutAction, type CheckoutFormState } from "./actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Opening checkout…" : label}
    </Button>
  );
}

export function UpgradeButton({ planCode, label }: { planCode: "pro" | "premium"; label: string }) {
  const [state, formAction] = useActionState<CheckoutFormState, FormData>(startCheckoutAction, {
    status: "idle",
  });

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="planCode" value={planCode} />
      <SubmitButton label={label} />
      {state.status === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
    </form>
  );
}
