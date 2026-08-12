import "server-only";
import { alias } from "drizzle-orm/pg-core";
import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { clientProfiles, coachProfiles, engagements, messages, users } from "@/lib/db/schema";
import { coachCanAccessClientData, type EngagementStatus } from "@/lib/access/policies";

const coachUsers = alias(users, "coach_users");
const clientUsers = alias(users, "client_users");

// No read receipts, typing indicators, or last-seen — CLAUDE.md hard rule 9.
// read_at is used ONLY to compute the viewer's own unread count (an inbox
// badge showing them they have something new), never to tell either party
// whether the OTHER side has read a message. Do not add an endpoint, field,
// or UI affordance that exposes read_at for anyone but the viewer's own
// unread state.

export type MessagingError =
  | { code: "unauthorized" }
  | { code: "forbidden" }
  | { code: "not_found"; resource: string }
  | { code: "engagement_inactive" }
  | { code: "validation"; message: string };

export type MessagingResult<T> = { ok: true; data: T } | { ok: false; error: MessagingError };
function ok<T>(data: T): MessagingResult<T> {
  return { ok: true, data };
}
function fail<T>(error: MessagingError): MessagingResult<T> {
  return { ok: false, error };
}

const HISTORICAL_ACCESS_WINDOW_DAYS = 90; // matches lib/checkins/service.ts — same rule 5 window
const ACTIVE_ENGAGEMENT_STATUSES = ["accepted", "active", "paused"] as const;

export interface ConversationSummary {
  engagementId: string;
  counterpartName: string;
  lastMessageBody: string | null;
  lastMessageAt: Date | null;
  unreadCount: number;
  canSend: boolean;
}

export async function getCoachConversations(coachId: string): Promise<ConversationSummary[]> {
  const engagementRows = await db
    .select({
      id: engagements.id,
      status: engagements.status,
      endedAt: engagements.endedAt,
      clientDisplayName: users.displayName,
    })
    .from(engagements)
    .innerJoin(clientProfiles, eq(clientProfiles.id, engagements.clientId))
    .innerJoin(users, eq(users.id, clientProfiles.userId))
    .where(eq(engagements.coachId, coachId))
    .orderBy(sql`${engagements.startedAt} DESC NULLS LAST`, desc(engagements.createdAt));

  return buildConversationSummaries(engagementRows, "coachId");
}

export async function getClientConversations(clientId: string): Promise<ConversationSummary[]> {
  const engagementRows = await db
    .select({
      id: engagements.id,
      status: engagements.status,
      endedAt: engagements.endedAt,
      clientDisplayName: users.displayName, // aliased below to coach's name
    })
    .from(engagements)
    .innerJoin(coachProfiles, eq(coachProfiles.id, engagements.coachId))
    .innerJoin(users, eq(users.id, coachProfiles.userId))
    .where(eq(engagements.clientId, clientId))
    .orderBy(sql`${engagements.startedAt} DESC NULLS LAST`, desc(engagements.createdAt));

  return buildConversationSummaries(engagementRows, "clientId");
}

async function buildConversationSummaries(
  engagementRows: { id: string; status: string; endedAt: Date | null; clientDisplayName: string }[],
  viewerKind: "coachId" | "clientId",
): Promise<ConversationSummary[]> {
  // The access window bounds the COACH's access to a client's data (CLAUDE.md
  // rule 5). A client's access to their own message history is never
  // time-limited — same rule as check-in history: "the coach access window
  // restricts the coach, never the client's access to their own data."
  const visible =
    viewerKind === "clientId"
      ? engagementRows
      : engagementRows.filter((e) =>
          coachCanAccessClientData({
            engagementStatus: e.status as EngagementStatus,
            engagementEndedAt: e.endedAt,
            dataCreatedAt: new Date(0),
            historicalAccessWindowDays: HISTORICAL_ACCESS_WINDOW_DAYS,
          }),
        );
  if (visible.length === 0) return [];

  const engagementIds = visible.map((e) => e.id);
  const lastMessages = await db
    .selectDistinctOn([messages.engagementId], {
      engagementId: messages.engagementId,
      body: messages.body,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(inArray(messages.engagementId, engagementIds))
    .orderBy(messages.engagementId, desc(messages.createdAt));
  const lastByEngagement = new Map(lastMessages.map((m) => [m.engagementId, m]));

  return visible.map((e) => ({
    engagementId: e.id,
    counterpartName: e.clientDisplayName,
    lastMessageBody: lastByEngagement.get(e.id)?.body ?? null,
    lastMessageAt: lastByEngagement.get(e.id)?.createdAt ?? null,
    unreadCount: 0, // filled in by callers that need it via getUnreadCounts, kept out of the list query for speed
    canSend: ACTIVE_ENGAGEMENT_STATUSES.includes(e.status as (typeof ACTIVE_ENGAGEMENT_STATUSES)[number]),
  }));
}

/** Unread counts per engagement, for the viewer's own inbox badges — never exposed to the other party. */
export async function getUnreadCounts(engagementIds: string[], viewerUserId: string): Promise<Map<string, number>> {
  if (engagementIds.length === 0) return new Map();
  const rows = await db
    .select({ engagementId: messages.engagementId, count: sql<number>`count(*)::int` })
    .from(messages)
    .where(and(inArray(messages.engagementId, engagementIds), ne(messages.senderUserId, viewerUserId), isNull(messages.readAt)))
    .groupBy(messages.engagementId);
  return new Map(rows.map((r) => [r.engagementId, r.count]));
}

export interface MessageItem {
  id: string;
  senderUserId: string;
  body: string | null;
  createdAt: Date;
  isMine: boolean;
}

interface ParticipantInfo {
  status: EngagementStatus;
  endedAt: Date | null;
  coachUserId: string;
  clientUserId: string;
  coachDisplayName: string;
  clientDisplayName: string;
}

// One query for status/participants/names, joining both sides at once —
// avoids a second round trip to re-verify the client and a third to fetch
// the counterpart's name for display.
async function assertParticipant(
  engagementId: string,
  viewerUserId: string,
  viewerRole: "coach" | "client",
): Promise<MessagingResult<ParticipantInfo>> {
  const [row] = await db
    .select({
      status: engagements.status,
      endedAt: engagements.endedAt,
      coachUserId: coachUsers.id,
      coachDisplayName: coachUsers.displayName,
      clientUserId: clientUsers.id,
      clientDisplayName: clientUsers.displayName,
    })
    .from(engagements)
    .innerJoin(coachProfiles, eq(coachProfiles.id, engagements.coachId))
    .innerJoin(coachUsers, eq(coachUsers.id, coachProfiles.userId))
    .innerJoin(clientProfiles, eq(clientProfiles.id, engagements.clientId))
    .innerJoin(clientUsers, eq(clientUsers.id, clientProfiles.userId))
    .where(eq(engagements.id, engagementId))
    .limit(1);
  if (!row) return fail({ code: "not_found", resource: "engagement" });

  const info: ParticipantInfo = {
    status: row.status as EngagementStatus,
    endedAt: row.endedAt,
    coachUserId: row.coachUserId,
    clientUserId: row.clientUserId,
    coachDisplayName: row.coachDisplayName,
    clientDisplayName: row.clientDisplayName,
  };

  const viewerIsParticipant = viewerRole === "coach" ? info.coachUserId === viewerUserId : info.clientUserId === viewerUserId;
  if (!viewerIsParticipant) return fail({ code: "not_found", resource: "engagement" });

  // Same rule as the conversation list: the access window bounds the coach
  // only. A client can always reach their own thread.
  if (viewerRole === "coach") {
    const canAccess = coachCanAccessClientData({
      engagementStatus: info.status,
      engagementEndedAt: info.endedAt,
      dataCreatedAt: new Date(0),
      historicalAccessWindowDays: HISTORICAL_ACCESS_WINDOW_DAYS,
    });
    if (!canAccess) return fail({ code: "not_found", resource: "engagement" });
  }

  return ok(info);
}

export async function getThread(
  engagementId: string,
  viewerUserId: string,
  viewerRole: "coach" | "client",
): Promise<MessagingResult<{ messages: MessageItem[]; canSend: boolean; counterpartName: string }>> {
  const access = await assertParticipant(engagementId, viewerUserId, viewerRole);
  if (!access.ok) return access;

  // Only clamps for a coach — a client's own message history is never
  // time-limited, same as the conversation list above.
  const visibleUpTo =
    viewerRole === "coach" && access.data.status === "ended" && access.data.endedAt ? access.data.endedAt : null;

  const rows = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.engagementId, engagementId),
        ...(visibleUpTo ? [sql`${messages.createdAt} <= ${visibleUpTo.toISOString()}`] : []),
      ),
    )
    .orderBy(asc(messages.createdAt));

  // Opening the thread marks the OTHER party's messages as read, for the
  // viewer's own unread badge only — this never becomes a signal shown back
  // to the sender (CLAUDE.md rule 9).
  await db
    .update(messages)
    .set({ readAt: new Date() })
    .where(and(eq(messages.engagementId, engagementId), ne(messages.senderUserId, viewerUserId), isNull(messages.readAt)));

  return ok({
    messages: rows.map((m) => ({ id: m.id, senderUserId: m.senderUserId, body: m.body, createdAt: m.createdAt, isMine: m.senderUserId === viewerUserId })),
    canSend: ACTIVE_ENGAGEMENT_STATUSES.includes(access.data.status as (typeof ACTIVE_ENGAGEMENT_STATUSES)[number]),
    counterpartName: viewerRole === "coach" ? access.data.clientDisplayName : access.data.coachDisplayName,
  });
}

export async function sendMessage(
  engagementId: string,
  senderUserId: string,
  senderRole: "coach" | "client",
  body: string,
): Promise<MessagingResult<{ messageId: string }>> {
  const access = await assertParticipant(engagementId, senderUserId, senderRole);
  if (!access.ok) return access;
  if (!ACTIVE_ENGAGEMENT_STATUSES.includes(access.data.status as (typeof ACTIVE_ENGAGEMENT_STATUSES)[number])) {
    return fail({ code: "engagement_inactive" });
  }
  if (!body.trim()) return fail({ code: "validation", message: "Message can't be empty." });

  const [created] = await db
    .insert(messages)
    .values({ engagementId, senderUserId, body: body.trim() })
    .returning({ id: messages.id });

  return ok({ messageId: created.id });
}
