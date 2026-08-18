import { requireRole } from "@/lib/auth/require-role";
import { signOutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { AmbientBackground } from "@/components/ambient-background";
import { DashboardSidebar, type NavLink } from "@/components/dashboard-sidebar";

const NAV_LINKS: NavLink[] = [
  { href: "/admin", label: "Dashboard", icon: "home" },
  { href: "/admin/moderation", label: "Moderation", icon: "shield" },
  { href: "/admin/coaches", label: "Coaches", icon: "users" },
  { href: "/admin/news", label: "News", icon: "megaphone" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("admin");

  return (
    <div className="relative min-h-svh">
      <AmbientBackground />
      <DashboardSidebar
        links={NAV_LINKS}
        greeting={`Admin — ${user.displayName}`}
        signOutSlot={
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" className="h-11 w-full justify-start px-3 text-muted-foreground">
              Sign out
            </Button>
          </form>
        }
      />
      <div className="md:pl-64">
        <main className="mx-auto max-w-6xl p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
