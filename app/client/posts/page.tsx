import { requireRole } from "@/lib/auth/require-role";
import { getClientProfileIdForUser } from "@/lib/logging/service";
import { listPostsForClientOwner } from "@/lib/content/service";
import { getCrisisResources } from "@/lib/domain/community-safety";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PostMediaDisplay } from "@/components/post-media";
import { CompleteProfilePrompt } from "@/components/complete-profile-prompt";
import { NewClientPostForm } from "./new-post-form";
import { deleteClientPostAction } from "./actions";
import { BackButton } from "@/components/back-button";

export default async function ClientPostsPage() {
  const user = await requireRole("client");
  const clientId = await getClientProfileIdForUser(user.id);
  if (!clientId) return <CompleteProfilePrompt />;

  const posts = await listPostsForClientOwner(clientId);

  return (
    <div className="mx-auto max-w-2xl">
      <BackButton className="mb-4 self-start" />
      <h1 className="text-2xl font-semibold">Posts</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Share a win or an update. Your posts are public and labelled &ldquo;Client&rdquo;. Videos also appear in Reels.
        You can delete a post at any time.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">New post</CardTitle>
        </CardHeader>
        <CardContent>
          <NewClientPostForm crisisResources={getCrisisResources("PH")} />
        </CardContent>
      </Card>

      <div className="mt-8 flex flex-col gap-4">
        {posts.map((post) => (
          <Card key={post.id}>
            <CardHeader>
              <CardTitle className="flex items-baseline justify-between text-base">
                <span>{post.title}</span>
                <span className="text-xs font-normal text-muted-foreground">{post.kind?.replace(/_/g, " ")} · Public</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <PostMediaDisplay media={post.media} />
              <p className="whitespace-pre-line text-muted-foreground">{post.bodyMd}</p>
              <form action={deleteClientPostAction.bind(null, post.id)}>
                <Button type="submit" variant="ghost" size="sm">Delete</Button>
              </form>
            </CardContent>
          </Card>
        ))}
        {posts.length === 0 && <p className="text-sm text-muted-foreground">No posts yet.</p>}
      </div>
    </div>
  );
}
