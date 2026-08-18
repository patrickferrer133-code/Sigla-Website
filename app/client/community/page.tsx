import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { getClientProfileIdForUser } from "@/lib/logging/service";
import { listGlobalCommunities, listCoachCommunitiesForClient, getMembership } from "@/lib/community/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { joinCommunityAction } from "./actions";
import { BackButton } from "@/components/back-button";

export default async function CommunityListPage() {
  const user = await requireRole("client");
  const clientId = await getClientProfileIdForUser(user.id);
  if (!clientId) return <p className="text-sm text-muted-foreground">Complete your account first.</p>;

  const [globalCommunities, coachCommunities] = await Promise.all([
    listGlobalCommunities(),
    listCoachCommunitiesForClient(clientId),
  ]);

  const globalWithMembership = await Promise.all(
    globalCommunities.map(async (c) => ({ community: c, isMember: Boolean(await getMembership(c.id, user.id)) })),
  );
  const coachWithMembership = await Promise.all(
    coachCommunities.map(async (row) => ({ ...row, isMember: Boolean(await getMembership(row.community.id, user.id)) })),
  );

  return (
    <div className="mx-auto max-w-xl">
      <BackButton className="mb-4 self-start" />
      <h1 className="text-2xl font-semibold">Community</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        A judgement-free space. Post under your name or anonymously — your call, every time.
      </p>

      <h2 className="mt-8 text-lg font-semibold">By goal</h2>
      <div className="mt-3 flex flex-col gap-3">
        {globalWithMembership.map(({ community, isMember }) => (
          <Card key={community.id}>
            <CardHeader>
              <CardTitle className="text-base">{community.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{community.description}</span>
              {isMember ? (
                <Link href={`/client/community/${community.id}`} className="text-primary underline underline-offset-4">Open</Link>
              ) : (
                <form action={joinCommunityAction.bind(null, community.id)}>
                  <Button type="submit" size="sm">Join</Button>
                </form>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {coachWithMembership.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-semibold">Your coach&apos;s community</h2>
          <div className="mt-3 flex flex-col gap-3">
            {coachWithMembership.map(({ community, coachHandle, isMember }) => (
              <Card key={community.id}>
                <CardHeader>
                  <CardTitle className="text-base">{community.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">@{coachHandle}</span>
                  {isMember ? (
                    <Link href={`/client/community/${community.id}`} className="text-primary underline underline-offset-4">Open</Link>
                  ) : (
                    <form action={joinCommunityAction.bind(null, community.id)}>
                      <Button type="submit" size="sm">Join</Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
