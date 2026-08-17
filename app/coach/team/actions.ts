"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { getCoachProfileIdForUser } from "@/lib/programs/service";
import { inviteTeamMemberSchema } from "@/lib/team/schemas";
import { inviteTeamMember, removeTeamMember } from "@/lib/team/service";

export type InviteFormState = { status: "idle" } | { status: "error"; message: string } | { status: "invited" };

export async function inviteTeamMemberAction(_prevState: InviteFormState, formData: FormData): Promise<InviteFormState> {
  const user = await requireRole("coach");
  const coachId = await getCoachProfileIdForUser(user.id);
  if (!coachId) return { status: "error", message: "Complete your coach profile first." };

  const parsed = inviteTeamMemberSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { status: "error", message: "Enter a valid email." };

  const result = await inviteTeamMember(coachId, user.id, parsed.data);
  if (!result.ok) {
    if (result.error.code === "seat_limit_reached") return { status: "error", message: "You're at your plan's assistant seat limit." };
    if (result.error.code === "not_found") return { status: "error", message: "No Sigla account found with that email." };
    if (result.error.code === "not_a_coach") return { status: "error", message: "That account isn't a coach account." };
    if (result.error.code === "already_member") return { status: "error", message: "Already on your team." };
    if (result.error.code === "cannot_invite_self") return { status: "error", message: "You can't add yourself." };
    return { status: "error", message: "Could not add them. Try again." };
  }

  revalidatePath("/coach/team");
  return { status: "invited" };
}

export async function removeTeamMemberAction(memberId: string, _formData: FormData) {
  const user = await requireRole("coach");
  const coachId = await getCoachProfileIdForUser(user.id);
  if (!coachId) return;

  await removeTeamMember(coachId, memberId);
  revalidatePath("/coach/team");
}
