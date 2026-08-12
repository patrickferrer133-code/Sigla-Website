import { requireRole } from "@/lib/auth/require-role";
import { getCoachProfileIdForUser } from "@/lib/programs/service";
import { listPostsForCoachOwner } from "@/lib/content/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NewPostForm } from "./new-post-form";
import { deletePostAction } from "./actions";

export default async function PostsPage() {
  const user = await requireRole("coach");
  const coachId = await getCoachProfileIdForUser(user.id);
  if (!coachId) return <p className="text-sm text-muted-foreground">Complete your coach profile first.</p>;

  const posts = await listPostsForCoachOwner(coachId);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">Posts</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Public posts appear on your profile and in the client feed. Clients-only posts reach only your current and past clients.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">New post</CardTitle>
        </CardHeader>
        <CardContent>
          <NewPostForm />
        </CardContent>
      </Card>

      <div className="mt-8 flex flex-col gap-4">
        {posts.map((post) => (
          <Card key={post.id}>
            <CardHeader>
              <CardTitle className="flex items-baseline justify-between text-base">
                <span>{post.title}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {post.kind?.replace(/_/g, " ")} · {post.visibility === "public" ? "Public" : "Clients only"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <p className="whitespace-pre-line text-muted-foreground">{post.bodyMd}</p>
              <form action={deletePostAction.bind(null, post.id)}>
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
