import { requireRole } from "@/lib/auth/require-role";
import { CommunityDetail } from "@/components/community/community-detail";

export default async function CoachCommunityDetailPage({ params }: { params: Promise<{ communityId: string }> }) {
  const { communityId } = await params;
  const user = await requireRole("coach");
  return <CommunityDetail communityId={communityId} userId={user.id} />;
}
