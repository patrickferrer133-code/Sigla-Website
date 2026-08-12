"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { applyToPackageAction, type ApplyFormState } from "./actions";

const initialState: ApplyFormState = { status: "idle" };

export function ApplyButton({ packageId }: { packageId: string }) {
  const action = applyToPackageAction.bind(null, packageId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  if (state.status === "success") {
    return <p className="text-sm font-medium text-primary">Application sent. The coach will follow up soon.</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Sending..." : "Apply"}
      </Button>
      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
    </form>
  );
}
