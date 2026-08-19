import { requireRole } from "@/lib/auth/require-role";
import { getCoachProfileIdForUser } from "@/lib/programs/service";
import {
  getMembership,
  getOrCreateCoachCommunity,
  listCommunitiesOwnedBy,
  listGlobalCommunities,
  listUserCreatedCommunities,
} from "@/lib/community/service";
import { BackButton } from "@/components/back-button";
import { CommunityCards, type CommunityCardItem } from "@/components/community/community-cards";
import { CreateCommunityForm } from "@/components/community/create-community-form";

const BASE_PATH = "/coach/community";

export default async function CoachCommunityPage() {
  const user = await requireRole("coach");
  const coachId = await getCoachProfileIdForUser(user.id);
  if (!coachId) return <p className="text-sm text-muted-foreground">Complete your coach profile first.</p>;

  // The coach's own client space is lazily provisioned, same as on the client
  // side, so it always exists by the time this page renders.
  const clientSpace = await getOrCreateCoachCommunity(coachId);

  const [globalCommunities, userCommunities, owned] = await Promise.all([
    listGlobalCommunities(),
    listUserCreatedCommunities(),
    listCommunitiesOwnedBy(coachId, "coach"),
  ]);

  const ownedIds = new Set(owned.map((row) => row.id));

  const toItems = async (
    rows: { id: string; name: string; description: string | null; coverPhotoUrl: string | null; joinPolicy: "open" | "request" | "clients_only" }[],
  ): Promise<CommunityCardItem[]> =>
    Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        coverPhotoUrl: row.coverPhotoUrl,
        joinPolicy: row.joinPolicy,
        membershipRole: (await getMembership(row.id, user.id))?.role ?? null,
      })),
    );

  const [ownedItems, globalItems, discoverItems, clientSpaceItems] = await Promise.all([
    toItems(owned),
    toItems(globalCommunities),
    toItems(userCommunities.filter((row) => !ownedIds.has(row.id))),
    toItems(clientSpace ? [clientSpace] : []),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <BackButton className="mb-4 self-start" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Community</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Run a group of your own, or take part in the wider Sigla community.
          </p>
        </div>
        <CreateCommunityForm basePath={BASE_PATH} />
      </div>

      <h2 className="mt-8 text-lg font-semibold">Your client space</h2>
      <CommunityCards items={clientSpaceItems} basePath={BASE_PATH} />

      {ownedItems.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-semibold">Communities you own</h2>
          <CommunityCards items={ownedItems} basePath={BASE_PATH} />
        </>
      )}

      <h2 className="mt-8 text-lg font-semibold">Discover</h2>
      <CommunityCards items={discoverItems} basePath={BASE_PATH} />

      <h2 className="mt-8 text-lg font-semibold">By goal</h2>
      <CommunityCards items={globalItems} basePath={BASE_PATH} />
    </div>
  );
}
