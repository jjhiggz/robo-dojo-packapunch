CREATE TABLE "songs" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"artist" varchar(255) NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"points" integer DEFAULT 1 NOT NULL,
	"banana_sticker" boolean DEFAULT false NOT NULL,
	"submitter_id" varchar(255)
);
