import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/back-button";
import { getCrisisResources } from "@/lib/domain/community-safety";
import { canManageCommunity, ownerLinkHref } from "@/lib/domain/community-ownership";
import {
  getActiveMembership,
  getCommunityWithOwner,
  getMembership,
  listCommentsForPost,
  listPendingRequests,
  listPostsForCommunity,
} from "@/lib/community/service";
import { joinCommunityAction, resolveJoinRequestAction } from "@/lib/community/actions";
import { DEFAULT_COVER_GRADIENT } from "./cover-gradient";
import { CommunityCoverPhotoForm } from "./cover-photo-form";
import { PostForm } from "./post-form";
import { CommentForm } from "./comment-form";
import { ReportButton } from "./report-button";

function OwnerBadge({ role }: { role: "coach" | "client" }) {
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground ring-1 ring-border">
      {role === "coach" ? "Coach" : "Client"}
    </span>
  );
}

/**
 * The community "group page". Shared by the coach and client surfaces so both
 * roles get exactly one implementation, and so the authorization checks below
 * cannot drift apart between the two routes.
 */
export async function CommunityDetail({ communityId, userId }: { communityId: string; userId: string }) {
  const found = await getCommunityWithOwner(communityId);
  if (!found) notFound();
  const { community, owner } = found;

  const membership = await getMembership(communityId, userId);
  const activeMembership = await getActiveMembership(communityId, userId);
  const isOwner = canManageCommunity(membership?.role);
  const ownerHref = ownerLinkHref(owner);

  const header = (
    <>
      <BackButton className="mb-4 self-start" />
      <div className={`h-36 w-full overflow-hidden rounded-2xl sm:h-48 ${community.coverPhotoUrl ? "" : DEFAULT_COVER_GRADIENT}`}>
        {community.coverPhotoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL
          <img src={community.coverPhotoUrl} alt="" className="size-full object-cover" />
        )}
      </div>

      <div className="mt-4">
        <h1 className="text-2xl font-semibold">{community.name}</h1>
        {community.description && <p className="mt-1 text-sm text-muted-foreground">{community.description}</p>}

        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Owner</span>
          {owner ? (
            <>
              {ownerHref ? (
                <Link href={ownerHref} className="font-medium text-foreground underline underline-offset-4">
                  {owner.displayName}
                </Link>
              ) : (
                // A client owner has no public profile page, so this is
                // deliberately plain text rather than a dead link.
                <span className="font-medium text-foreground">{owner.displayName}</span>
              )}
              <OwnerBadge role={owner.role} />
            </>
          ) : (
            <span className="font-medium text-foreground">Sigla</span>
          )}
        </p>

        {isOwner && (
          <div className="mt-3">
            <CommunityCoverPhotoForm communityId={communityId} />
          </div>
        )}
      </div>
    </>
  );

  if (!activeMembership) {
    const pending = membership?.role === "pending";
    return (
      <div className="mx-auto max-w-2xl">
        {header}
        <div className="mt-6 rounded-2xl border p-4">
          {pending ? (
            <p className="text-sm text-muted-foreground">
              Your request to join is with the owner. You&apos;ll see the posts once it&apos;s approved.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {community.joinPolicy === "open"
                  ? "Join to see the posts and take part."
                  : "This community approves members. Ask to join and the owner will review it."}
              </p>
              <form action={joinCommunityAction.bind(null, communityId)} className="mt-3">
                <Button type="submit" className="min-h-11 rounded-full px-5">
                  {community.joinPolicy === "open" ? "Join" : "Ask to join"}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    );
  }

  const requests = isOwner ? await listPendingRequests(communityId, userId) : null;
  const posts = await listPostsForCommunity(communityId);
  const postsWithComments = await Promise.all(
    posts.map(async (post) => ({ post, comments: await listCommentsForPost(post.id) })),
  );
  const crisisResources = getCrisisResources("PH");

  return (
    <div className="mx-auto max-w-2xl">
      {header}

      <p className="mt-3 text-xs text-muted-foreground">
        Posting as {activeMembership.displayAlias} when anonymous.
      </p>

      {requests?.ok && requests.data.length > 0 && (
        <div className="mt-6 rounded-2xl border p-4">
          <h2 className="text-sm font-semibold">Join requests</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {requests.data.map((request) => (
              <li key={request.userId} className="flex items-center justify-between gap-3 text-sm">
                <span>{request.displayName}</span>
                <span className="flex gap-2">
                  <form action={resolveJoinRequestAction.bind(null, communityId, request.userId, "approve")}>
                    <Button type="submit" size="sm">
                      Approve
                    </Button>
                  </form>
                  <form action={resolveJoinRequestAction.bind(null, communityId, request.userId, "decline")}>
                    <Button type="submit" size="sm" variant="ghost">
                      Decline
                    </Button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6">
        <PostForm communityId={communityId} crisisResources={crisisResources} />
      </div>

      <div className="mt-8 flex flex-col gap-6">
        {postsWithComments.map(({ post, comments }) => (
          <article key={post.id} className="border-b pb-6 last:border-0">
            <div className="flex items-baseline justify-between">
              {/* displayName is already the alias for an anonymous post —
                  listPostsForCommunity never returns the author's user id. */}
              <span className="text-sm font-medium">{post.displayName}</span>
              <span className="text-xs text-muted-foreground">{new Date(post.createdAt).toLocaleDateString()}</span>
            </div>
            <p className="mt-1 whitespace-pre-line text-sm">{post.bodyMd}</p>

            {post.media?.type === "image" && (
              // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL
              <img src={post.media.url} alt="" className="mt-2 w-full rounded-xl object-cover" loading="lazy" />
            )}
            {post.media?.type === "video" && (
              <video src={post.media.url} controls playsInline preload="metadata" className="mt-2 w-full rounded-xl" />
            )}

            <div className="mt-2 flex items-center gap-3">
              <ReportButton targetType="community_post" targetId={post.id} communityId={communityId} />
            </div>

            {comments.length > 0 && (
              <div className="mt-3 flex flex-col gap-2 border-l pl-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="text-sm">
                    <span className="font-medium">{comment.authorDisplayName}</span>{" "}
                    <span className="text-muted-foreground">{comment.bodyMd}</span>
                    {/* docs/06 section 5: a report control on every post AND
                        every comment, not just the post. */}
                    <div className="mt-1">
                      <ReportButton targetType="community_comment" targetId={comment.id} communityId={communityId} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <CommentForm postId={post.id} communityId={communityId} crisisResources={crisisResources} />
          </article>
        ))}
        {postsWithComments.length === 0 && <p className="text-sm text-muted-foreground">No posts yet. Be the first.</p>}
      </div>
    </div>
  );
}
