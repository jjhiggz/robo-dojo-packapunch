-- Fix banana_stickers column type from varchar to integer
-- This was missed in migration 0003 which only renamed the column
ALTER TABLE "songs" ALTER COLUMN "banana_stickers" TYPE integer USING COALESCE(banana_stickers::integer, 0);--> statement-breakpoint
ALTER TABLE "songs" ALTER COLUMN "banana_stickers" SET DEFAULT 0;


