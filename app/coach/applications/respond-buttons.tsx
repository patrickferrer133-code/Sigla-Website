"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { respondToApplicationAction, type RespondFormState } from "./actions";

const initialState: RespondFormState = { status: "idle" };

export function RespondButtons({ engagementId }: { engagementId: string }) {
  const declineAction = respondToApplicationAction.bind(null, engagementId, "decline");
  const acceptAction = respondToApplicationAction.bind(null, engagementId, "accept");
  const [declineState, declineFormAction] = useActionState(declineAction, initialState);
  const [acceptState, acceptFormAction] = useActionState(acceptAction, initialState);

  const error = declineState.status === "error" ? declineState.message : acceptState.status === "error" ? acceptState.message : null;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <form action={declineFormAction}>
          <Button type="submit" variant="ghost" size="sm">Decline</Button>
        </form>
        <form action={acceptFormAction}>
          <Button type="submit" size="sm">Accept</Button>
        </form>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
