import { describe, expect, it } from "vitest";
import {
  addOneMonthUtc,
  attributeCheckoutPaid,
  buildSignaturePayload,
  isHandledEventType,
  isSignatureTimestampFresh,
  isUpgradeFrom,
  nextMonthlyPeriod,
  parseSignatureHeader,
  parseWebhookEnvelope,
  planCodeForTier,
  tierForPlanCode,
} from "./billing-webhook";

const COACH = "0198a2b1-1111-7000-8000-000000000001";
const PLAN = "0198a2b1-2222-7000-8000-000000000002";
const PRICE = "0198a2b1-3333-7000-8000-000000000003";

function checkoutPaidEvent(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      id: "evt_abc123",
      type: "event",
      attributes: {
        type: "checkout_session.payment.paid",
        data: {
          id: "cs_live_123",
          type: "checkout_session",
          attributes: {
            metadata: { coachId: COACH, planId: PLAN, planPriceId: PRICE },
            ...overrides,
          },
        },
      },
    },
  };
}

describe("tier and plan code mapping", () => {
  it("maps the starter plan code onto the free tier and back", () => {
    expect(tierForPlanCode("starter")).toBe("free");
    expect(planCodeForTier("free")).toBe("starter");
  });

  it("passes paid codes through unchanged", () => {
    expect(tierForPlanCode("pro")).toBe("pro");
    expect(tierForPlanCode("premium")).toBe("premium");
    expect(planCodeForTier("premium")).toBe("premium");
  });

  it("treats only strictly higher tiers as upgrades", () => {
    expect(isUpgradeFrom("free", "pro")).toBe(true);
    expect(isUpgradeFrom("free", "premium")).toBe(true);
    expect(isUpgradeFrom("pro", "premium")).toBe(true);
    expect(isUpgradeFrom("pro", "pro")).toBe(false);
    expect(isUpgradeFrom("premium", "pro")).toBe(false);
    expect(isUpgradeFrom("premium", "free")).toBe(false);
  });
});

describe("parseSignatureHeader", () => {
  it("parses a full test-and-live header", () => {
    const result = parseSignatureHeader("t=1700000000,te=aaa,li=bbb");
    expect(result).toEqual({
      ok: true,
      data: { timestamp: "1700000000", testSignature: "aaa", liveSignature: "bbb" },
    });
  });

  it("accepts a header with only one of te/li present", () => {
    const result = parseSignatureHeader("t=1700000000,te=aaa");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.liveSignature).toBeNull();
  });

  it("tolerates whitespace between segments", () => {
    const result = parseSignatureHeader("t=1700000000, li=bbb");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.liveSignature).toBe("bbb");
  });

  it("rejects a missing, empty, timestamp-less, or signature-less header", () => {
    for (const header of [null, undefined, "", "te=aaa,li=bbb", "t=1700000000", "t=notanumber,te=aaa"]) {
      const result = parseSignatureHeader(header);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("malformed_signature_header");
    }
  });
});

describe("buildSignaturePayload", () => {
  it("joins timestamp and raw body with a single dot, byte for byte", () => {
    expect(buildSignaturePayload("1700000000", '{"a":1}')).toBe('1700000000.{"a":1}');
  });
});

describe("isSignatureTimestampFresh", () => {
  it("accepts a timestamp inside the tolerance window on either side", () => {
    expect(isSignatureTimestampFresh("1700000000", 1700000000)).toBe(true);
    expect(isSignatureTimestampFresh("1700000000", 1700000299)).toBe(true);
    expect(isSignatureTimestampFresh("1700000000", 1699999701)).toBe(true);
  });

  it("rejects a stale or far-future timestamp", () => {
    expect(isSignatureTimestampFresh("1700000000", 1700000301)).toBe(false);
    expect(isSignatureTimestampFresh("1700000000", 1699999699)).toBe(false);
  });

  it("rejects a non-numeric timestamp", () => {
    expect(isSignatureTimestampFresh("abc", 1700000000)).toBe(false);
  });
});

describe("parseWebhookEnvelope", () => {
  it("flattens PayMongo's double-nested envelope", () => {
    const result = parseWebhookEnvelope(checkoutPaidEvent());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.eventId).toBe("evt_abc123");
    expect(result.data.eventType).toBe("checkout_session.payment.paid");
    expect(result.data.resourceId).toBe("cs_live_123");
  });

  it("rejects a payload that is not a PayMongo event", () => {
    for (const bad of [null, {}, { data: {} }, { data: { id: "evt_1", attributes: {} } }, "nope"]) {
      const result = parseWebhookEnvelope(bad);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("malformed_envelope");
    }
  });
});

describe("isHandledEventType", () => {
  it("handles only the checkout paid event", () => {
    expect(isHandledEventType("checkout_session.payment.paid")).toBe(true);
    expect(isHandledEventType("payment.paid")).toBe(false);
    expect(isHandledEventType("payment.failed")).toBe(false);
    expect(isHandledEventType("source.chargeable")).toBe(false);
  });
});

describe("attributeCheckoutPaid", () => {
  it("extracts coach, plan, and price ids from session metadata", () => {
    const envelope = parseWebhookEnvelope(checkoutPaidEvent());
    expect(envelope.ok).toBe(true);
    if (!envelope.ok) return;

    const result = attributeCheckoutPaid(envelope.data);
    expect(result).toEqual({
      ok: true,
      data: {
        checkoutSessionId: "cs_live_123",
        coachId: COACH,
        planId: PLAN,
        planPriceId: PRICE,
        paidAmountCents: null,
        providerPaymentIntentId: null,
        providerCustomerId: null,
      },
    });
  });

  it("reads the captured amount in centavos and the payment intent from the payments array", () => {
    const envelope = parseWebhookEnvelope(
      checkoutPaidEvent({
        payments: [{ id: "pay_1", attributes: { amount: 99000, payment_intent_id: "pi_1" } }],
        customer_id: "cus_1",
      }),
    );
    if (!envelope.ok) throw new Error("envelope should parse");

    const result = attributeCheckoutPaid(envelope.data);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.paidAmountCents).toBe(99000);
    expect(result.data.providerPaymentIntentId).toBe("pi_1");
    expect(result.data.providerCustomerId).toBe("cus_1");
  });

  it("prefers the expanded payment_intent object when both are present", () => {
    const envelope = parseWebhookEnvelope(
      checkoutPaidEvent({
        payment_intent: { id: "pi_expanded" },
        payments: [{ attributes: { payment_intent_id: "pi_fallback" } }],
      }),
    );
    if (!envelope.ok) throw new Error("envelope should parse");

    const result = attributeCheckoutPaid(envelope.data);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.providerPaymentIntentId).toBe("pi_expanded");
  });

  it("fails closed when metadata is absent, so an unattributable payment never activates a plan", () => {
    const raw = checkoutPaidEvent();
    raw.data.attributes.data.attributes = {} as never;
    const envelope = parseWebhookEnvelope(raw);
    if (!envelope.ok) throw new Error("envelope should parse");

    const result = attributeCheckoutPaid(envelope.data);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("missing_checkout_metadata");
  });

  it("fails closed when metadata ids are not uuids", () => {
    const envelope = parseWebhookEnvelope(
      checkoutPaidEvent({ metadata: { coachId: "not-a-uuid", planId: PLAN, planPriceId: PRICE } }),
    );
    if (!envelope.ok) throw new Error("envelope should parse");

    const result = attributeCheckoutPaid(envelope.data);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("missing_checkout_metadata");
  });

  it("refuses to attribute an event of a different type", () => {
    const raw = checkoutPaidEvent();
    raw.data.attributes.type = "payment.failed";
    const envelope = parseWebhookEnvelope(raw);
    if (!envelope.ok) throw new Error("envelope should parse");

    const result = attributeCheckoutPaid(envelope.data);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("unsupported_event");
  });
});

describe("addOneMonthUtc", () => {
  it("adds a calendar month and preserves the time of day", () => {
    expect(addOneMonthUtc(new Date("2026-03-15T08:30:00.000Z")).toISOString()).toBe(
      "2026-04-15T08:30:00.000Z",
    );
  });

  it("clamps to the last day of a shorter month instead of rolling over", () => {
    expect(addOneMonthUtc(new Date("2026-01-31T00:00:00.000Z")).toISOString()).toBe(
      "2026-02-28T00:00:00.000Z",
    );
    expect(addOneMonthUtc(new Date("2028-01-31T00:00:00.000Z")).toISOString()).toBe(
      "2028-02-29T00:00:00.000Z",
    );
    expect(addOneMonthUtc(new Date("2026-05-31T00:00:00.000Z")).toISOString()).toBe(
      "2026-06-30T00:00:00.000Z",
    );
  });

  it("rolls the year over in December", () => {
    expect(addOneMonthUtc(new Date("2026-12-10T12:00:00.000Z")).toISOString()).toBe(
      "2027-01-10T12:00:00.000Z",
    );
  });
});

describe("nextMonthlyPeriod", () => {
  it("starts now and ends one month later", () => {
    const now = new Date("2026-08-18T03:00:00.000Z");
    expect(nextMonthlyPeriod(now)).toEqual({
      currentPeriodStart: now,
      currentPeriodEnd: new Date("2026-09-18T03:00:00.000Z"),
    });
  });
});
