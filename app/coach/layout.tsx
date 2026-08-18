import { requireRole } from "@/lib/auth/require-role";
import { signOutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { AmbientBackground } from "@/components/ambient-background";
import { DashboardSidebar, type NavLink } from "@/components/dashboard-sidebar";

const NAV_LINKS: NavLink[] = [
  { href: "/coach", label: "Dashboard", icon: "home" },
  { href: "/coach/applications", label: "Applications", icon: "inbox" },
  { href: "/coach/packages", label: "Packages", icon: "tag" },
  { href: "/coach/posts", label: "Posts", icon: "image" },
  { href: "/coach/content-studio", label: "Content Studio", icon: "sparkles" },
  { href: "/coach/programs", label: "Programs", icon: "clipboard" },
  { href: "/coach/checkins", label: "Check-ins", icon: "check-circle" },
  { href: "/coach/messages", label: "Messages", icon: "message-circle" },
  { href: "/coach/billing", label: "Billing", icon: "credit-card" },
  { href: "/coach/team", label: "Team", icon: "users" },
  { href: "/coach/settings", label: "Settings", icon: "settings" },
  { href: "/profile", label: "Profile", icon: "user-circle" },
];

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("coach");

  return (
    <div className="relative min-h-svh">
      <AmbientBackground />
      <DashboardSidebar
        links={NAV_LINKS}
        greeting={`Coach — ${user.displayName}`}
        signOutSlot={
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" className="h-11 w-full justify-start px-3 text-muted-foreground">
              Sign out
            </Button>
          </form>
        }
      />
      <div className="md:pl-64">
        <main className="mx-auto max-w-7xl p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
