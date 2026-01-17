ALTER TABLE "songs" RENAME COLUMN "link_type" TO "banana_stickers";--> statement-breakpoint
ALTER TABLE "songs" ADD COLUMN "youtube_url" varchar(500);--> statement-breakpoint
ALTER TABLE "songs" ADD COLUMN "spotify_url" varchar(500);--> statement-breakpoint
ALTER TABLE "songs" ADD COLUMN "soundcloud_url" varchar(500);--> statement-breakpoint
ALTER TABLE "songs" ADD COLUMN "instagram_url" varchar(500);--> statement-breakpoint
ALTER TABLE "songs" ADD COLUMN "tiktok_url" varchar(500);--> statement-breakpoint
ALTER TABLE "songs" DROP COLUMN "link";--> statement-breakpoint
ALTER TABLE "songs" DROP COLUMN "banana_sticker";