import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { getClientProfileIdForUser } from "@/lib/logging/service";
import { getClientConversations, getUnreadCounts } from "@/lib/messaging/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/back-button";

export default async function ClientMessagesPage() {
  const user = await requireRole("client");
  const clientId = await getClientProfileIdForUser(user.id);
  const conversations = clientId ? await getClientConversations(clientId) : [];
  const unreadByEngagement = await getUnreadCounts(conversations.map((c) => c.engagementId), user.id);

  return (
    <div className="mx-auto max-w-2xl">
      <BackButton className="mb-4 self-start" />
      <h1 className="text-2xl font-semibold">Messages</h1>

      {conversations.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Messages with your coach show up here once you have one.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-2">
          {conversations.map((c) => {
            const unread = unreadByEngagement.get(c.engagementId) ?? 0;
            return (
              <Link key={c.engagementId} href={`/client/messages/${c.engagementId}`}>
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
