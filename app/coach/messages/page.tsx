import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { getCoachProfileIdForUser } from "@/lib/programs/service";
import { getCoachConversations, getUnreadCounts } from "@/lib/messaging/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CompleteProfilePrompt } from "@/components/complete-profile-prompt";

export default async function CoachMessagesPage() {
  const user = await requireRole("coach");
  const coachId = await getCoachProfileIdForUser(user.id);
  if (!coachId) return <CompleteProfilePrompt />;

  const conversations = await getCoachConversations(coachId);
  const unreadByEngagement = await getUnreadCounts(conversations.map((c) => c.engagementId), user.id);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">Messages</h1>

      {conversations.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No conversations yet — they start once you have a client.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-2">
          {conversations.map((c) => {
            const unread = unreadByEngagement.get(c.engagementId) ?? 0;
            return (
              <Link key={c.engagementId} href={`/coach/messages/${c.engagementId}`}>
                <Card className="transition-colors hover:border-primary">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">{c.counterpartName}</CardTitle>
                    {unread > 0 && <Badge>{unread}</Badge>}
                  </CardHeader>
                  {c.lastMessageBody && (
                    <CardContent className="truncate text-sm text-muted-foreground">{c.lastMessageBody}</CardContent>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
