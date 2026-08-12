import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { getThread } from "@/lib/messaging/service";
import { MessageForm } from "./message-form";

export default async function CoachThreadPage({ params }: { params: Promise<{ engagementId: string }> }) {
  const { engagementId } = await params;
  const user = await requireRole("coach");

  const result = await getThread(engagementId, user.id, "coach");
  if (!result.ok) notFound();
  const { messages, canSend, counterpartName } = result.data;

  return (
    <div className="mx-auto flex h-[calc(100svh-9rem)] max-w-2xl flex-col">
      <h1 className="text-xl font-semibold">{counterpartName}</h1>

      <div className="mt-4 flex-1 overflow-y-auto rounded-md border">
        <div className="flex flex-col gap-2 p-3">
          {messages.length === 0 && <p className="text-sm text-muted-foreground">No messages yet. Say hello.</p>}
          {messages.map((m) => (
            <div key={m.id} className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${m.isMine ? "self-end bg-primary text-primary-foreground" : "self-start bg-muted"}`}>
              {m.body}
            </div>
          ))}
        </div>
      </div>

      {canSend ? (
        <MessageForm engagementId={engagementId} />
      ) : (
        <p className="border-t p-3 text-sm text-muted-foreground">This engagement has ended. You can&apos;t send new messages.</p>
      )}
    </div>
  );
}
