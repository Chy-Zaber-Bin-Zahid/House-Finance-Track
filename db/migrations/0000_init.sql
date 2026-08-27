-- A unit must never have two tenancies covering the same month. Enforcing that
-- with an exclusion constraint makes it impossible to violate regardless of what
-- application code does, or of two people writing at once. Combining an equality
-- column with a range column needs btree_gist.
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
CREATE TYPE "public"."account_role" AS ENUM('owner', 'super_admin', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."account_status" AS ENUM('awaiting', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."entry_status" AS ENUM('paid', 'upcoming');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"status" "account_status" DEFAULT 'awaiting' NOT NULL,
	"role" "account_role",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "bill_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"bill_type_id" integer NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"status" "entry_status" DEFAULT 'upcoming' NOT NULL,
	CONSTRAINT "bill_entries_type_month" UNIQUE("bill_type_id","year","month"),
	CONSTRAINT "bill_entries_month_range" CHECK ("bill_entries"."month" between 1 and 12),
	CONSTRAINT "bill_entries_amount_non_negative" CHECK ("bill_entries"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "bill_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "bill_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "rent_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenancy_id" integer NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"status" "entry_status" DEFAULT 'upcoming' NOT NULL,
	CONSTRAINT "rent_entries_tenancy_month" UNIQUE("tenancy_id","year","month"),
	CONSTRAINT "rent_entries_month_range" CHECK ("rent_entries"."month" between 1 and 12),
	CONSTRAINT "rent_entries_amount_non_negative" CHECK ("rent_entries"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"unlocked_year" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenancies" (
	"id" serial PRIMARY KEY NOT NULL,
	"unit_id" integer NOT NULL,
	"tenant_id" integer NOT NULL,
	"period" daterange NOT NULL,
	"expected_rent" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"floor" text DEFAULT 'Not set' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bill_entries" ADD CONSTRAINT "bill_entries_bill_type_id_bill_types_id_fk" FOREIGN KEY ("bill_type_id") REFERENCES "public"."bill_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_entries" ADD CONSTRAINT "rent_entries_tenancy_id_tenancies_id_fk" FOREIGN KEY ("tenancy_id") REFERENCES "public"."tenancies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenancies" ADD CONSTRAINT "tenancies_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenancies" ADD CONSTRAINT "tenancies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenancies" ADD CONSTRAINT "tenancies_no_overlapping_period" EXCLUDE USING GIST ("unit_id" WITH =, "period" WITH &&);
