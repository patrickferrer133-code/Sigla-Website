import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { getClientProfileIdForUser } from "@/lib/logging/service";
import { listFeedForClient } from "@/lib/content/service";
import { PostMediaDisplay } from "@/components/post-media";
import { BackButton } from "@/components/back-button";

export default async function FeedPage() {
  const user = await requireRole("client");
  const clientId = await getClientProfileIdForUser(user.id);
  if (!clientId) return <p className="text-sm text-muted-foreground">Complete your account first.</p>;

  const posts = await listFeedForClient(clientId);

  return (
    <div className="mx-auto max-w-xl">
      <BackButton className="mb-4 self-start" />
      <h1 className="text-2xl font-semibold">Feed</h1>

      <div className="mt-6 flex flex-col gap-6">
        {posts.map((post) => (
          <article key={post.id} className="border-b pb-6 last:border-0">
            <div className="flex items-baseline justify-between">
              <Link href={`/c/${post.coachHandle}`} className="text-sm font-medium hover:underline">
                {post.coachDisplayName}
              </Link>
              <span className="text-xs text-muted-foreground">{post.kind?.replace(/_/g, " ")}</span>
            </div>
            <h2 className="mt-2 text-lg font-semibold">{post.title}</h2>
            {post.media && (
              <div className="mt-2">
                <PostMediaDisplay media={post.media} />
              </div>
            )}
            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{post.bodyMd}</p>
            {post.tags && post.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span key={tag} className="rounded-full border px-2.5 py-0.5 text-xs">{tag}</span>
                ))}
              </div>
            )}
          </article>
        ))}
        {posts.length === 0 && <p className="text-sm text-muted-foreground">No posts yet.</p>}
      </div>
    </div>
  );
}
