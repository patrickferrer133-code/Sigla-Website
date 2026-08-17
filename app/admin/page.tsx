import { requireRole } from "@/lib/auth/require-role";
import { listAllUsers, getSignupCounts } from "@/lib/admin/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminHomePage() {
  await requireRole("admin");
  const [signups, counts] = await Promise.all([listAllUsers(), getSignupCounts()]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Admin</h1>
      <p className="mt-2 text-sm text-muted-foreground">Every account that has signed up, most recent first.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-semibold">{counts.total}</p>
            <p className="text-xs text-muted-foreground">Total accounts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-semibold">{counts.coaches}</p>
            <p className="text-xs text-muted-foreground">Coaches</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-semibold">{counts.clients}</p>
            <p className="text-xs text-muted-foreground">Clients</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-semibold">{counts.last7Days}</p>
            <p className="text-xs text-muted-foreground">New this week</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">All signups</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {signups.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-0">
              <div className="flex items-center gap-2 truncate">
                <span className="glass flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs">
                  {u.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL
                    <img src={u.avatarUrl} alt="" className="size-full object-cover" />
                  ) : (
                    u.displayName.charAt(0).toUpperCase()
                  )}
                </span>
                <div className="truncate">
                  <p className="truncate font-medium">{u.displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                </div>
              </div>
              <div className="shrink-0 text-right text-xs text-muted-foreground">
                <p className="capitalize">{u.role}</p>
                <p>{new Date(u.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
          {signups.length === 0 && <p className="text-sm text-muted-foreground">No signups yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
