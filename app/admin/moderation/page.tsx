import { requireRole } from "@/lib/auth/require-role";
import { listOpenReports, getReportedContentBody } from "@/lib/community/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  resolveReportAction,
  takeDownCommunityCommentAction,
  takeDownCommunityPostAction,
  takeDownPostAction,
} from "./actions";
import { BackButton } from "@/components/back-button";
import { REPORT_REASON_LABEL } from "@/lib/community/report-reasons";

const REASON_LABEL: Record<string, string> = {
  ...REPORT_REASON_LABEL,
  self_harm_risk: "Possible self-harm risk",
};

const TARGET_LABEL: Record<string, string> = {
  community_post: "post",
  community_comment: "comment",
  coach_post: "post (feed / reels)",
  message: "message",
};

export default async function ModerationQueuePage() {
  await requireRole("admin");

  const reports = await listOpenReports();
  const reportsWithContent = await Promise.all(
    reports.map(async (report) => ({ report, content: await getReportedContentBody(report.targetType, report.targetId) })),
  );

  return (
    <div className="mx-auto max-w-2xl">
      <BackButton className="mb-4 self-start" />
      <h1 className="text-2xl font-semibold">Moderation queue</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Reports never auto-delete content. Every item here is waiting on a human decision.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        {reportsWithContent.map(({ report, content }) => (
          <Card key={report.id} className={report.reason === "self_harm_risk" ? "border-destructive/60 bg-destructive/5" : ""}>
            <CardHeader>
              <CardTitle className="flex items-baseline justify-between text-base">
                <span>{REASON_LABEL[report.reason] ?? report.reason}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {TARGET_LABEL[report.targetType] ?? report.targetType} · {report.source === "auto_flag" ? "auto-flagged" : "reported by a member"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <p className="whitespace-pre-line rounded-md border bg-background p-3 text-muted-foreground">
                {content.body ?? "(content no longer available)"}
              </p>

              {/* The reported media itself. A caption alone is not enough to
                  decide a takedown on a reported photo or video. */}
              {content.media?.type === "image" && (
                // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL
                <img src={content.media.url} alt="" className="w-full rounded-md border object-cover" />
              )}
              {content.media?.type === "video" && (
                <video src={content.media.url} controls playsInline preload="metadata" className="w-full rounded-md border" />
              )}

              <div className="flex flex-wrap gap-2">
                <form action={resolveReportAction.bind(null, report.id, "dismissed")}>
                  <Button type="submit" variant="ghost" size="sm">Dismiss</Button>
                </form>
                <form action={resolveReportAction.bind(null, report.id, "actioned")}>
                  <Button type="submit" size="sm">Mark actioned</Button>
                </form>
                {report.targetType === "coach_post" && (
                  <form action={takeDownPostAction.bind(null, report.id, report.targetId)}>
                    <Button type="submit" size="sm" variant="destructive">
                      Take down post
                    </Button>
                  </form>
                )}
                {report.targetType === "community_post" && (
                  <form action={takeDownCommunityPostAction.bind(null, report.id, report.targetId)}>
                    <Button type="submit" size="sm" variant="destructive">
                      Take down post
                    </Button>
                  </form>
                )}
                {report.targetType === "community_comment" && (
                  <form action={takeDownCommunityCommentAction.bind(null, report.id, report.targetId)}>
                    <Button type="submit" size="sm" variant="destructive">
                      Take down comment
                    </Button>
                  </form>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {reportsWithContent.length === 0 && <p className="text-sm text-muted-foreground">Queue is empty.</p>}
      </div>
    </div>
  );
}
