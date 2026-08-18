import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { signOutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { AmbientBackground } from "@/components/ambient-background";
import { Logo } from "@/components/logo";

const NAV_LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/moderation", label: "Moderation" },
  { href: "/admin/coaches", label: "Coaches" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("admin");

  return (
    <div className="relative min-h-svh">
      <AmbientBackground />
      <header className="sticky top-0 z-20 px-3 pt-3 sm:px-4">
        <div className="glass mx-auto flex max-w-6xl flex-col gap-3 rounded-2xl px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Logo className="h-5" />
              <p className="text-sm font-medium text-muted-foreground">Admin — {user.displayName}</p>
            </div>
            <form action={signOutAction} className="sm:hidden">
              <Button type="submit" variant="ghost" size="sm">Sign out</Button>
            </form>
          </div>
          <nav className="flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
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
      <main className="mx-auto max-w-6xl p-4 sm:p-6">{children}</main>
    </div>
  );
}
