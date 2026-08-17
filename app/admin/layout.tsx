import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { signOutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("admin");

  return (
    <div className="min-h-svh">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-6">
          <p className="text-sm text-muted-foreground">Admin — {user.displayName}</p>
          <nav className="flex items-center gap-4">
            <Link href="/admin" className="text-sm hover:text-primary hover:underline">Dashboard</Link>
            <Link href="/admin/moderation" className="text-sm hover:text-primary hover:underline">Moderation</Link>
            <Link href="/admin/coaches" className="text-sm hover:text-primary hover:underline">Coaches</Link>
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
