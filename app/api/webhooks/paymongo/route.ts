import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhookSignature } from "@/lib/billing/paymongo";
import {
  applyCheckoutPaid,
  markWebhookFailed,
  markWebhookProcessed,
  recordWebhookDelivery,
} from "@/lib/billing/webhook-service";
import { attributeCheckoutPaid, isHandledEventType, parseWebhookEnvelope } from "@/lib/domain/billing-webhook";

// HMAC verification needs node:crypto, and the handler talks to Postgres
// directly, so this route cannot run on the edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PayMongo webhooks for Sigla's OWN coach-subscription billing. This endpoint
// never processes client-to-coach money; that flow does not exist on-platform.
export async function POST(request: NextRequest) {
  // Raw bytes, not request.json(). The signature is computed over the exact
  // body PayMongo sent; re-serializing a parsed object would change key order
  // and whitespace and break the HMAC.
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("paymongo-signature");

  const verification = verifyWebhookSignature(rawBody, signatureHeader);
  if (!verification.valid) {
    // 401 on an unverified body. Nothing is recorded: an unsigned request is
    // not evidence that PayMongo sent anything, and writing it to
    // webhook_events would let an unauthenticated caller burn event ids.
    console.warn("[paymongo-webhook] rejected delivery:", verification.reason);
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const envelope = parseWebhookEnvelope(json);
  if (!envelope.ok) {
    // Signed by PayMongo but in a shape we do not understand. Retrying will
    // not change the shape, so ack it rather than looping.
    console.warn("[paymongo-webhook] malformed envelope:", envelope.error);
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const { eventId, eventType } = envelope.data;

  const delivery = await recordWebhookDelivery({ eventId, eventType, payload: json });
  if (!delivery.ok) {
    // Duplicate delivery of an event id we have already accepted. The unique
    // index on (provider, event_id) is the idempotency boundary: ack and stop,
    // without re-running any side effect.
    return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
  }
  const webhookEventId = delivery.data.id;

  if (!isHandledEventType(eventType)) {
    // Recorded for forensics, no side effects. `payment.paid` and
    // `payment.failed` land here on purpose: acting on them as well as on
    // checkout_session.payment.paid would double-apply the same payment.
    await markWebhookProcessed(webhookEventId, "ignored");
    return NextResponse.json({ received: true, ignored: true }, { status: 200 });
  }

  try {
    const attribution = attributeCheckoutPaid(envelope.data);
    if (!attribution.ok) {
      // A session without our metadata is not attributable to a coach and can
      // never become attributable on retry, so this is terminal, not a retry.
      await markWebhookFailed(webhookEventId, `attribution: ${JSON.stringify(attribution.error)}`);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const applied = await applyCheckoutPaid(attribution.data);
    if (!applied.ok) {
      await markWebhookFailed(webhookEventId, `apply: ${JSON.stringify(applied.error)}`);

      // Retry decision: `invoice_not_found` is the read-your-write race between
      // the checkout action's invoice insert and a very fast payment, and it
      // resolves on its own, so we return 500 and let PayMongo redeliver. The
      // dedupe row is already committed, and recordWebhookDelivery bumps
      // attempt_count on each redelivery, so a retry loop is bounded and
      // observable rather than silent. Every other failure here is terminal
      // (wrong coach, wrong amount, unknown plan) and must NOT be retried:
      // redelivering would just re-fail, and an amount mismatch in particular
      // is a signal for a human, not for the retry queue.
      const retryable = applied.error.code === "invoice_not_found";
      if (retryable) {
        return NextResponse.json({ error: "not ready, please retry" }, { status: 500 });
      }
      console.error("[paymongo-webhook] terminal failure", eventId, applied.error);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    await markWebhookProcessed(webhookEventId, "processed");
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (cause) {
    // An unexpected throw (database unavailable mid-transaction, etc.) is
    // assumed transient: mark failed, return 500, let PayMongo redeliver.
    const message = cause instanceof Error ? cause.message : "unknown error";
    console.error("[paymongo-webhook] unhandled error", eventId, message);
    try {
      await markWebhookFailed(webhookEventId, message);
    } catch {
      // Best effort. If the database is the thing that is down, the
      // reconciliation job picks the row up via processed_at IS NULL.
    }
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
