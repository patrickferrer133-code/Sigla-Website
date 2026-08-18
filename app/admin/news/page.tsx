import { requireRole } from "@/lib/auth/require-role";
import { listAnnouncementsForAdmin } from "@/lib/announcements/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackButton } from "@/components/back-button";
import { AnnouncementForm } from "./announcement-form";
import { AnnouncementControls } from "./announcement-controls";

const AUDIENCE_LABEL: Record<string, string> = {
  all: "Everyone",
  coaches: "Coaches only",
  clients: "Clients only",
};

export default async function AdminNewsPage() {
  await requireRole("admin");

  const items = await listAnnouncementsForAdmin();

  return (
    <div className="mx-auto max-w-2xl">
      <BackButton className="mb-4 self-start" />
      <h1 className="text-2xl font-semibold">News</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Platform-wide updates. Drafts are invisible until you publish them.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">New announcement</CardTitle>
        </CardHeader>
        <CardContent>
          <AnnouncementForm />
        </CardContent>
      </Card>

      <div className="mt-8 flex flex-col gap-4">
        {items.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <CardTitle className="flex items-baseline justify-between gap-3 text-base">
                <span>{item.title}</span>
                <span className="shrink-0 text-xs font-normal text-muted-foreground">
                  {AUDIENCE_LABEL[item.audience] ?? item.audience} · {item.isPublished ? "Published" : "Draft"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="whitespace-pre-line text-sm text-muted-foreground">{item.body}</p>
              <AnnouncementControls announcementId={item.id} isPublished={item.isPublished} />
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground">No announcements yet.</p>}
      </div>
    </div>
  );
}
