import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { signOutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/coach", label: "Dashboard" },
  { href: "/coach/programs", label: "Programs" },
  { href: "/coach/checkins", label: "Check-ins" },
  { href: "/coach/messages", label: "Messages" },
];

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("coach");

  return (
    <div className="min-h-svh">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-6">
          <p className="text-sm text-muted-foreground">Coach — {user.displayName}</p>
          <nav className="flex items-center gap-4">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="text-sm hover:text-primary hover:underline">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <form action={signOutAction}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
