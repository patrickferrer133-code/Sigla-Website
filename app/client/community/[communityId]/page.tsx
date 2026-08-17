import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { getMembership, listPostsForCommunity, listCommentsForPost } from "@/lib/community/service";
import { getCrisisResources } from "@/lib/domain/community-safety";
import { db } from "@/lib/db/client";
import { communities } from "@/lib/db/schema/community";
import { eq } from "drizzle-orm";
import { PostForm } from "./post-form";
import { CommentForm } from "./comment-form";
import { ReportButton } from "./report-button";

export default async function CommunityDetailPage({ params }: { params: Promise<{ communityId: string }> }) {
  const { communityId } = await params;
  const user = await requireRole("client");

  const [community] = await db.select().from(communities).where(eq(communities.id, communityId)).limit(1);
  if (!community) notFound();

  const membership = await getMembership(communityId, user.id);
  if (!membership) {
    return <p className="text-sm text-muted-foreground">Join this community first to see its posts.</p>;
  }

  const posts = await listPostsForCommunity(communityId);
  const postsWithComments = await Promise.all(
    posts.map(async (post) => ({ post, comments: await listCommentsForPost(post.id) })),
  );
  const crisisResources = getCrisisResources("PH");

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold">{community.name}</h1>
      {community.description && <p className="mt-1 text-sm text-muted-foreground">{community.description}</p>}
      <p className="mt-1 text-xs text-muted-foreground">Posting as {membership.displayAlias} when anonymous.</p>

      <div className="mt-6">
        <PostForm communityId={communityId} crisisResources={crisisResources} />
      </div>

      <div className="mt-8 flex flex-col gap-6">
        {postsWithComments.map(({ post, comments }) => (
          <article key={post.id} className="border-b pb-6 last:border-0">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">{post.displayName}</span>
              <span className="text-xs text-muted-foreground">{new Date(post.createdAt).toLocaleDateString()}</span>
            </div>
            <p className="mt-1 whitespace-pre-line text-sm">{post.bodyMd}</p>
            <div className="mt-2 flex items-center gap-3">
              <ReportButton targetType="community_post" targetId={post.id} communityId={communityId} />
            </div>

            {comments.length > 0 && (
              <div className="mt-3 flex flex-col gap-2 border-l pl-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="text-sm">
                    <span className="font-medium">{comment.authorDisplayName}</span>{" "}
                    <span className="text-muted-foreground">{comment.bodyMd}</span>
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
