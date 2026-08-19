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

/**
 * Same guarantee as requireRole for surfaces that legitimately serve more
 * than one role — communities, which any coach or client can own, join, and
 * post in. Still a server-side check on every call; never a substitute for
 * the per-resource authorization the service layer does.
 */
export async function requireAnyRole<R extends CurrentUser["role"]>(
  roles: readonly R[],
): Promise<CurrentUser & { role: R }> {
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=/${roles[0]}`);
  if (!(roles as readonly string[]).includes(user.role)) redirect(`/${user.role}`);
  return user as CurrentUser & { role: R };
}
