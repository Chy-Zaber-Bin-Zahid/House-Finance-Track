CREATE TABLE "audit_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer,
	"actor_email" text NOT NULL,
	"action" text NOT NULL,
	"subject" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_recent" ON "audit_events" USING btree ("created_at" DESC NULLS LAST);