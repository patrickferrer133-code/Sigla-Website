import { requireRole } from "@/lib/auth/require-role";
import { signOutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { AmbientBackground } from "@/components/ambient-background";
import { DashboardSidebar, type NavLink } from "@/components/dashboard-sidebar";

const NAV_LINKS: NavLink[] = [
  { href: "/client", label: "Today", icon: "sun" },
  { href: "/reels", label: "Reels", icon: "play-circle" },
  { href: "/client/feed", label: "Feed", icon: "grid" },
  { href: "/client/posts", label: "Posts", icon: "image" },
  { href: "/client/check-in", label: "Check-in", icon: "check-circle" },
  { href: "/client/progress", label: "Progress", icon: "trending-up" },
  { href: "/client/nutrition", label: "Nutrition", icon: "utensils" },
  { href: "/client/messages", label: "Messages", icon: "message-circle" },
  { href: "/client/coach", label: "My coach", icon: "user" },
  { href: "/client/community", label: "Community", icon: "users" },
  { href: "/profile", label: "Profile", icon: "user-circle" },
];

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("client");

  return (
    <div className="relative min-h-svh">
      <AmbientBackground />
      <DashboardSidebar
        links={NAV_LINKS}
        greeting={`Hi, ${user.displayName}`}
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
