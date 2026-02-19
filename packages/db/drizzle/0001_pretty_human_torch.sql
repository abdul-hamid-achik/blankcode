CREATE TABLE "cluster_locks" (
	"shard_id" varchar(50) PRIMARY KEY NOT NULL,
	"address" varchar(255) NOT NULL,
	"acquired_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cluster_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"shard_id" text,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"kind" text NOT NULL,
	"tag" text,
	"payload" jsonb,
	"headers" jsonb,
	"trace_id" text,
	"span_id" text,
	"sampled" integer,
	"request_id" text NOT NULL,
	"reply_id" text,
	"deliver_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cluster_migrations" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"timestamp" bigint NOT NULL,
	"done" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cluster_replies" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"request_id" text NOT NULL,
	"payload" jsonb,
	"sequence" bigint
);
--> statement-breakpoint
CREATE TABLE "cluster_runners" (
	"machine_id" serial PRIMARY KEY NOT NULL,
	"address" varchar(255) NOT NULL,
	"runner" text NOT NULL,
	"healthy" boolean DEFAULT true NOT NULL,
	"last_heartbeat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "code_drafts" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "blanks" jsonb DEFAULT '[]'::jsonb NOT NULL;