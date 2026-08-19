import { requireRole } from "@/lib/auth/require-role";
import { getClientProfileIdForUser } from "@/lib/logging/service";
import {
  getMembership,
  listCoachCommunitiesForClient,
  listGlobalCommunities,
  listUserCreatedCommunities,
} from "@/lib/community/service";
import { BackButton } from "@/components/back-button";
import { CommunityCards, type CommunityCardItem } from "@/components/community/community-cards";
import { CreateCommunityForm } from "@/components/community/create-community-form";

const BASE_PATH = "/client/community";

export default async function CommunityListPage() {
  const user = await requireRole("client");
  const clientId = await getClientProfileIdForUser(user.id);
  if (!clientId) return <p className="text-sm text-muted-foreground">Complete your account first.</p>;

  const [globalCommunities, coachCommunities, userCommunities] = await Promise.all([
    listGlobalCommunities(),
    listCoachCommunitiesForClient(clientId),
    listUserCreatedCommunities(),
  ]);

  const withMembership = async (
    rows: { id: string; name: string; description: string | null; coverPhotoUrl: string | null; joinPolicy: "open" | "request" | "clients_only" }[],
    subtitles: Record<string, string | null> = {},
  ): Promise<CommunityCardItem[]> =>
    Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        coverPhotoUrl: row.coverPhotoUrl,
        joinPolicy: row.joinPolicy,
        membershipRole: (await getMembership(row.id, user.id))?.role ?? null,
        subtitle: subtitles[row.id] ?? null,
      })),
    );

  const [globalItems, userItems, coachItems] = await Promise.all([
    withMembership(globalCommunities),
    withMembership(userCommunities),
    withMembership(
      coachCommunities.map((row) => row.community),
      Object.fromEntries(coachCommunities.map((row) => [row.community.id, `@${row.coachHandle}`])),
    ),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <BackButton className="mb-4 self-start" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Community</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A judgement-free space. Post under your name or anonymously — your call, every time.
          </p>
        </div>
        <CreateCommunityForm basePath={BASE_PATH} />
      </div>

      <h2 className="mt-8 text-lg font-semibold">By goal</h2>
      <CommunityCards items={globalItems} basePath={BASE_PATH} />

      <h2 className="mt-8 text-lg font-semibold">Communities</h2>
      <CommunityCards items={userItems} basePath={BASE_PATH} />

      {coachItems.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-semibold">Your coach&apos;s community</h2>
          <CommunityCards items={coachItems} basePath={BASE_PATH} />
        </>
      )}
    </div>
  );
}
