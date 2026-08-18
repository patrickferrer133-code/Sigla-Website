import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  buildSignaturePayload,
  isSignatureTimestampFresh,
  parseSignatureHeader,
} from "@/lib/domain/billing-webhook";

// Thin PayMongo REST client for Sigla's OWN coach-subscription billing
// (Starter/Pro/Premium — the coach pays Sigla). This provider is deliberately
// NOT wired to any client-to-coach money movement; Sigla holds and splits no
// client funds, per the resolved payments decision.

const PAYMONGO_BASE_URL = "https://api.paymongo.com/v1";

export type PaymongoError =
  | { code: "not_configured"; detail: string }
  | { code: "api_error"; status: number; detail: string }
  | { code: "network_error"; detail: string }
  | { code: "malformed_response"; detail: string };

export type PaymongoResult<T> = { ok: true; data: T } | { ok: false; error: PaymongoError };

function ok<T>(data: T): PaymongoResult<T> {
  return { ok: true, data };
}
function fail<T>(error: PaymongoError): PaymongoResult<T> {
  return { ok: false, error };
}

function secretKey(): string | null {
  const key = process.env.PAYMONGO_SECRET_KEY;
  return key && key.length > 0 ? key : null;
}

/** PayMongo test keys are prefixed `sk_test_`; live keys are `sk_live_`. */
export function isTestMode(): boolean {
  return (secretKey() ?? "").startsWith("sk_test_");
}

// HTTP Basic with the secret key as the username and an empty password.
function authHeader(key: string): string {
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

export interface CreateCheckoutSessionInput {
  coachId: string;
  planId: string;
  planPriceId: string;
  /**
   * Amount in the smallest currency unit. PHP's smallest unit is the centavo
   * (100 centavos = 1 peso), which is exactly the same convention as our
   * `amount_cents` columns — so `planPrices.amountCents` is passed through
   * with NO conversion. Do not multiply or divide by 100 here. Getting this
   * wrong is the single most common PayMongo integration bug (a coach charged
   * 100x or 1/100th of the plan price).
   */
  amountCents: number;
  /** ISO 4217, uppercase, e.g. "PHP". */
  currency: string;
  planName: string;
  successUrl: string;
  cancelUrl: string;
  /** Shown on the hosted page and the emailed receipt. */
  description?: string;
  /** Our invoice-facing reference; PayMongo echoes it back on the session. */
  referenceNumber?: string;
}

export interface CheckoutSession {
  checkoutSessionId: string;
  checkoutUrl: string;
}

/**
 * Creates a hosted PayMongo Checkout Session and returns the id plus the URL
 * to redirect the coach to.
 *
 * `metadata` carries coachId/planId/planPriceId so the webhook can attribute
 * the payment from the event payload itself rather than depending solely on a
 * session-id lookup.
 */
export async function createCheckoutSession(
  input: CreateCheckoutSessionInput,
): Promise<PaymongoResult<CheckoutSession>> {
  const key = secretKey();
  if (!key) return fail({ code: "not_configured", detail: "PAYMONGO_SECRET_KEY is not set" });

  const body = {
    data: {
      attributes: {
        line_items: [
          {
            currency: input.currency.toUpperCase(),
            // Centavos, passed straight through. See CreateCheckoutSessionInput.amountCents.
            amount: input.amountCents,
            name: input.planName,
            quantity: 1,
          },
        ],
        payment_method_types: ["gcash", "card", "grab_pay", "paymaya"],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        send_email_receipt: true,
        show_description: true,
        show_line_items: true,
        description: input.description ?? input.planName,
        ...(input.referenceNumber ? { reference_number: input.referenceNumber } : {}),
        metadata: {
          coachId: input.coachId,
          planId: input.planId,
          planPriceId: input.planPriceId,
        },
      },
    },
  };

  let response: Response;
  try {
    response = await fetch(`${PAYMONGO_BASE_URL}/checkout_sessions`, {
      method: "POST",
      headers: {
        Authorization: authHeader(key),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (cause) {
    return fail({ code: "network_error", detail: cause instanceof Error ? cause.message : "fetch failed" });
  }

  const text = await response.text();
  if (!response.ok) {
    // Never surface the raw provider body to the coach; the action maps this
    // to a generic message. It is safe to keep here for server-side logging.
    return fail({ code: "api_error", status: response.status, detail: text.slice(0, 500) });
  }

  // The response envelope is narrow enough to read directly; the domain-level
  // Zod schemas cover the webhook payloads, which are the untrusted ones.
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return fail({ code: "malformed_response", detail: "response was not JSON" });
  }

  const data = (parsed as { data?: { id?: unknown; attributes?: { checkout_url?: unknown } } }).data;
  const id = data?.id;
  const url = data?.attributes?.checkout_url;
  if (typeof id !== "string" || typeof url !== "string") {
    return fail({ code: "malformed_response", detail: "missing checkout session id or checkout_url" });
  }

  return ok({ checkoutSessionId: id, checkoutUrl: url });
}

export type SignatureVerification =
  | { valid: true }
  | { valid: false; reason: "not_configured" | "malformed_header" | "stale_timestamp" | "mismatch" };

/**
 * Verifies a `Paymongo-Signature` header against the RAW request body.
 *
 * The body must be the exact bytes received (`request.text()`), not a
 * re-serialized parse — JSON.stringify would reorder keys and change
 * whitespace, breaking the HMAC.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  nowEpochSeconds: number = Math.floor(Date.now() / 1000),
): SignatureVerification {
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!secret) return { valid: false, reason: "not_configured" };

  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed.ok) return { valid: false, reason: "malformed_header" };

  const { timestamp, testSignature, liveSignature } = parsed.data;
  if (!isSignatureTimestampFresh(timestamp, nowEpochSeconds)) {
    return { valid: false, reason: "stale_timestamp" };
  }

  // Test-mode webhooks sign into `te`, live-mode into `li`. Pick by the key we
  // are configured with so a test-mode signature can never satisfy live mode.
  const expected = isTestMode() ? testSignature : liveSignature;
  if (!expected) return { valid: false, reason: "mismatch" };

  const computed = createHmac("sha256", secret)
    .update(buildSignaturePayload(timestamp, rawBody))
    .digest("hex");

  const a = Buffer.from(computed, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return { valid: false, reason: "mismatch" };
  return timingSafeEqual(a, b) ? { valid: true } : { valid: false, reason: "mismatch" };
}
