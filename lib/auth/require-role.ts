import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "./current-user";

/** Redirects to sign-in if unauthenticated, or to the user's own dashboard if the role doesn't match. */
export async function requireRole(role: CurrentUser["role"]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=/${role}`);
  if (user.role !== role) redirect(`/${user.role}`);
  return user;
}
