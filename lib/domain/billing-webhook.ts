// Pure parsing / attribution logic for PayMongo platform-billing webhooks.
//
// Scope: Sigla's OWN coach subscription billing (Starter/Pro/Premium — the
// coach pays Sigla). This has nothing to do with client-to-coach money, which
// stays off-platform per the resolved payments decision. Nothing in this file
// touches the database, the network, or the clock.

import { z } from "zod";

export type CoachTierCode = "free" | "pro" | "premium";
export type PlanCode = "starter" | "pro" | "premium";

export type WebhookError =
  | { code: "malformed_envelope"; detail: string }
  | { code: "malformed_signature_header" }
  | { code: "unsupported_event"; eventType: string }
  | { code: "missing_checkout_metadata"; detail: string };

export type WebhookResult<T> = { ok: true; data: T } | { ok: false; error: WebhookError };

function ok<T>(data: T): WebhookResult<T> {
  return { ok: true, data };
}
function fail<T>(error: WebhookError): WebhookResult<T> {
  return { ok: false, error };
}

// ---------------------------------------------------------------------------
// Plan <-> tier mapping
// ---------------------------------------------------------------------------

// `plans.code` calls the free tier "starter"; `coach_profiles.tier` calls it
// "free". Both names are already live in the database, so the mapping lives
// here rather than being papered over with a migration.
export function tierForPlanCode(code: PlanCode): CoachTierCode {
  return code === "starter" ? "free" : code;
}

export function planCodeForTier(tier: CoachTierCode): PlanCode {
  return tier === "free" ? "starter" : tier;
}

const TIER_RANK: Record<CoachTierCode, number> = { free: 0, pro: 1, premium: 2 };

/** True when `target` is a strict upgrade from `current`. Drives which upgrade buttons render. */
export function isUpgradeFrom(current: CoachTierCode, target: CoachTierCode): boolean {
  return TIER_RANK[target] > TIER_RANK[current];
}

// ---------------------------------------------------------------------------
// Signature header
// ---------------------------------------------------------------------------

export interface ParsedSignatureHeader {
  timestamp: string;
  testSignature: string | null;
  liveSignature: string | null;
}

/**
 * Parses a `Paymongo-Signature` header of the form
 * `t=<unix_seconds>,te=<hmac>,li=<hmac>`. Either `te` or `li` may be absent
 * depending on whether the sending webhook is in test or live mode.
 */
export function parseSignatureHeader(header: string | null | undefined): WebhookResult<ParsedSignatureHeader> {
  if (!header) return fail({ code: "malformed_signature_header" });

  const parts = new Map<string, string>();
  for (const segment of header.split(",")) {
    const eq = segment.indexOf("=");
    if (eq <= 0) continue;
    parts.set(segment.slice(0, eq).trim(), segment.slice(eq + 1).trim());
  }

  const timestamp = parts.get("t");
  const testSignature = parts.get("te") ?? null;
  const liveSignature = parts.get("li") ?? null;
  if (!timestamp || !/^\d+$/.test(timestamp)) return fail({ code: "malformed_signature_header" });
  if (!testSignature && !liveSignature) return fail({ code: "malformed_signature_header" });

  return ok({ timestamp, testSignature, liveSignature });
}

/** The exact string PayMongo HMACs: `<timestamp>.<raw request body>`. */
export function buildSignaturePayload(timestamp: string, rawBody: string): string {
  return `${timestamp}.${rawBody}`;
}

/**
 * Whether the delivery is recent enough to accept, in seconds. Replay window
 * guard: an attacker who captures a valid body+signature pair cannot replay it
 * indefinitely. (Duplicate delivery of a *legitimate* event is handled
 * separately by the webhook_events unique index, not by this.)
 */
export const SIGNATURE_TOLERANCE_SECONDS = 300;

export function isSignatureTimestampFresh(
  timestamp: string,
  nowEpochSeconds: number,
  toleranceSeconds: number = SIGNATURE_TOLERANCE_SECONDS,
): boolean {
  const sent = Number(timestamp);
  if (!Number.isFinite(sent)) return false;
  return Math.abs(nowEpochSeconds - sent) <= toleranceSeconds;
}

// ---------------------------------------------------------------------------
// Event envelope
// ---------------------------------------------------------------------------

// PayMongo wraps everything twice: an outer `data` for the event resource and
// an inner `attributes.data` for the resource the event is about.
const envelopeSchema = z.object({
  data: z.object({
    id: z.string().min(1),
    attributes: z.object({
      type: z.string().min(1),
      data: z.object({
        id: z.string().min(1),
        attributes: z.record(z.string(), z.unknown()).default({}),
      }),
    }),
  }),
});

export interface WebhookEnvelope {
  eventId: string;
  eventType: string;
  resourceId: string;
  resourceAttributes: Record<string, unknown>;
}

export function parseWebhookEnvelope(json: unknown): WebhookResult<WebhookEnvelope> {
  const parsed = envelopeSchema.safeParse(json);
  if (!parsed.success) {
    return fail({ code: "malformed_envelope", detail: parsed.error.issues[0]?.message ?? "invalid shape" });
  }
  const { id, attributes } = parsed.data.data;
  return ok({
    eventId: id,
    eventType: attributes.type,
    resourceId: attributes.data.id,
    resourceAttributes: attributes.data.attributes,
  });
}

/** Event types this handler acts on. Anything else is recorded and marked `ignored`. */
export const HANDLED_EVENT_TYPES = ["checkout_session.payment.paid"] as const;

/** Event types we deliberately record but take no action on (the payment-level
 * mirrors of the checkout event — acting on both would double-apply). */
export const ACKNOWLEDGED_EVENT_TYPES = ["payment.paid", "payment.failed"] as const;

export type HandledEventType = (typeof HANDLED_EVENT_TYPES)[number];

export function isHandledEventType(eventType: string): eventType is HandledEventType {
  return (HANDLED_EVENT_TYPES as readonly string[]).includes(eventType);
}

// ---------------------------------------------------------------------------
// Checkout attribution
// ---------------------------------------------------------------------------

// Metadata we set when creating the session. Carrying the ids here means the
// webhook can attribute a payment without trusting a lookup on session id
// alone. PayMongo stringifies metadata values, so everything is a string.
const checkoutMetadataSchema = z.object({
  coachId: z.uuid(),
  planId: z.uuid(),
  planPriceId: z.uuid(),
});

export type CheckoutMetadata = z.infer<typeof checkoutMetadataSchema>;

const checkoutAttributesSchema = z.object({
  metadata: checkoutMetadataSchema,
  payment_intent: z
    .object({ id: z.string().min(1).optional() })
    .loose()
    .nullish(),
  payments: z
    .array(
      z
        .object({
          id: z.string().optional(),
          attributes: z
            .object({
              amount: z.number().int().optional(),
              payment_intent_id: z.string().optional(),
            })
            .loose()
            .optional(),
        })
        .loose(),
    )
    .optional(),
  customer_id: z.string().nullish(),
});

export interface CheckoutPaidAttribution {
  checkoutSessionId: string;
  coachId: string;
  planId: string;
  planPriceId: string;
  /** Amount actually captured, in centavos, when the payload reports it. */
  paidAmountCents: number | null;
  providerPaymentIntentId: string | null;
  providerCustomerId: string | null;
}

/**
 * Extracts everything needed to settle an invoice and activate a subscription
 * from a `checkout_session.payment.paid` envelope. Fails closed: a session
 * without our metadata is not attributable to a coach and must not be applied.
 */
export function attributeCheckoutPaid(envelope: WebhookEnvelope): WebhookResult<CheckoutPaidAttribution> {
  if (envelope.eventType !== "checkout_session.payment.paid") {
    return fail({ code: "unsupported_event", eventType: envelope.eventType });
  }

  const parsed = checkoutAttributesSchema.safeParse(envelope.resourceAttributes);
  if (!parsed.success) {
    return fail({
      code: "missing_checkout_metadata",
      detail: parsed.error.issues[0]?.message ?? "invalid checkout session attributes",
    });
  }

  const attrs = parsed.data;
  const firstPayment = attrs.payments?.[0];

  return ok({
    checkoutSessionId: envelope.resourceId,
    coachId: attrs.metadata.coachId,
    planId: attrs.metadata.planId,
    planPriceId: attrs.metadata.planPriceId,
    paidAmountCents: firstPayment?.attributes?.amount ?? null,
    providerPaymentIntentId:
      attrs.payment_intent?.id ?? firstPayment?.attributes?.payment_intent_id ?? null,
    providerCustomerId: attrs.customer_id ?? null,
  });
}

// ---------------------------------------------------------------------------
// Billing period arithmetic
// ---------------------------------------------------------------------------

/**
 * Adds one calendar month in UTC, clamping to the last day of the target month
 * so 31 Jan + 1 month is 28/29 Feb rather than rolling into March. A coach
 * billed on the 31st must not silently skip a month.
 */
export function addOneMonthUtc(start: Date): Date {
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth();
  const day = start.getUTCDate();
  const daysInTarget = new Date(Date.UTC(year, month + 2, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      year,
      month + 1,
      Math.min(day, daysInTarget),
      start.getUTCHours(),
      start.getUTCMinutes(),
      start.getUTCSeconds(),
      start.getUTCMilliseconds(),
    ),
  );
}

export interface SubscriptionPeriod {
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}

export function nextMonthlyPeriod(now: Date): SubscriptionPeriod {
  return { currentPeriodStart: now, currentPeriodEnd: addOneMonthUtc(now) };
}
