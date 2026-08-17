import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { signOutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { AmbientBackground } from "@/components/ambient-background";

const NAV_LINKS = [
  { href: "/coach", label: "Dashboard" },
  { href: "/coach/applications", label: "Applications" },
  { href: "/coach/packages", label: "Packages" },
  { href: "/coach/posts", label: "Posts" },
  { href: "/coach/content-studio", label: "Content Studio" },
  { href: "/coach/programs", label: "Programs" },
  { href: "/coach/checkins", label: "Check-ins" },
  { href: "/coach/messages", label: "Messages" },
  { href: "/coach/billing", label: "Billing" },
  { href: "/coach/team", label: "Team" },
  { href: "/coach/settings", label: "Settings" },
  { href: "/profile", label: "Profile" },
];

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("coach");

  return (
    <div className="relative min-h-svh">
      <AmbientBackground />
      <header className="sticky top-0 z-20 px-3 pt-3 sm:px-4">
        <div className="glass mx-auto flex max-w-7xl flex-col gap-3 rounded-2xl px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-muted-foreground">Coach — {user.displayName}</p>
            <form action={signOutAction} className="sm:hidden">
              <Button type="submit" variant="ghost" size="sm">Sign out</Button>
            </form>
          </div>
          <nav className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 sm:mx-0 sm:px-0">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="shrink-0 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <form action={signOutAction} className="hidden sm:block">
            <Button type="submit" variant="ghost" size="sm">Sign out</Button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4 sm:p-6">{children}</main>
    </div>
  );
}
