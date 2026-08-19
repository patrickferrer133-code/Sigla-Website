import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { joinCommunityAction } from "@/lib/community/actions";
import { DEFAULT_COVER_GRADIENT } from "./cover-gradient";

export interface CommunityCardItem {
  id: string;
  name: string;
  description: string | null;
  coverPhotoUrl: string | null;
  joinPolicy: "open" | "request" | "clients_only";
  /** null when the viewer has no membership row at all. */
  membershipRole: string | null;
  subtitle?: string | null;
}

/** Group-page style cards: a cover strip, the name, and a join/open control. */
export function CommunityCards({ items, basePath }: { items: CommunityCardItem[]; basePath: string }) {
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {items.map((item) => {
        const isPending = item.membershipRole === "pending";
        const isMember = item.membershipRole != null && !isPending;
        return (
          <Card key={item.id} className="overflow-hidden pt-0">
            <Link href={`${basePath}/${item.id}`} className="block">
              <div className={`h-24 w-full overflow-hidden ${item.coverPhotoUrl ? "" : DEFAULT_COVER_GRADIENT}`}>
                {item.coverPhotoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL
                  <img src={item.coverPhotoUrl} alt="" className="size-full object-cover" />
                )}
              </div>
            </Link>
            <CardContent className="flex flex-col gap-2">
              <Link href={`${basePath}/${item.id}`} className="text-base font-semibold">
                {item.name}
              </Link>
              {item.subtitle && <span className="text-xs text-muted-foreground">{item.subtitle}</span>}
              {item.description && <span className="line-clamp-2 text-sm text-muted-foreground">{item.description}</span>}
              <div className="mt-1">
                {isMember ? (
                  <Link href={`${basePath}/${item.id}`} className="text-sm text-primary underline underline-offset-4">
                    Open
                  </Link>
                ) : isPending ? (
                  <span className="text-sm text-muted-foreground">Request sent</span>
                ) : (
                  <form action={joinCommunityAction.bind(null, item.id)}>
                    <Button type="submit" size="sm" className="rounded-full">
                      {item.joinPolicy === "open" ? "Join" : "Ask to join"}
                    </Button>
                  </form>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
      {items.length === 0 && <p className="text-sm text-muted-foreground">Nothing here yet.</p>}
    </div>
  );
}
