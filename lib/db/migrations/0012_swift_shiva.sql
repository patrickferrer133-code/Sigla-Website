CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"status" text DEFAULT 'received' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error" text
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "provider_checkout_session_id" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "provider_payment_intent_id" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "platform_subscription_id" uuid;--> statement-breakpoint
ALTER TABLE "platform_subscriptions" ADD COLUMN "provider_customer_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_provider_event_id_idx" ON "webhook_events" USING btree ("provider","event_id");--> statement-breakpoint
CREATE INDEX "webhook_events_unprocessed_idx" ON "webhook_events" USING btree ("provider","received_at") WHERE "webhook_events"."processed_at" IS NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_platform_subscription_id_platform_subscriptions_id_fk" FOREIGN KEY ("platform_subscription_id") REFERENCES "public"."platform_subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoices_coach_id_idx" ON "invoices" USING btree ("coach_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_provider_checkout_session_id_idx" ON "invoices" USING btree ("provider_checkout_session_id") WHERE "invoices"."provider_checkout_session_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "platform_subscriptions_coach_id_idx" ON "platform_subscriptions" USING btree ("coach_id");--> statement-breakpoint
ALTER TABLE "webhook_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_status_check"
  CHECK ("status" IN ('received','processed','failed','ignored'));