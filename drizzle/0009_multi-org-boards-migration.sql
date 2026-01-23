-- Migration: Multi-Organization Boards Architecture
-- This migration creates the multi-org, multi-board structure and migrates existing data to SCAROB org

-- Step 1: Create new tables
-- =========================================================

-- Users table
CREATE TABLE IF NOT EXISTS "users" (
  "user_id" varchar(255) PRIMARY KEY NOT NULL,
  "email" varchar(255) NOT NULL,
  "name" varchar(255),
  "global_role" varchar(20) NOT NULL DEFAULT 'user',
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Organizations table
CREATE TABLE IF NOT EXISTS "organizations" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(255) NOT NULL,
  "slug" varchar(255) NOT NULL UNIQUE,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Boards table
CREATE TABLE IF NOT EXISTS "boards" (
  "id" serial PRIMARY KEY NOT NULL,
  "organization_id" integer NOT NULL REFERENCES "organizations"("id"),
  "name" varchar(255) NOT NULL,
  "slug" varchar(255) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "boards_org_slug_unique" UNIQUE("organization_id", "slug")
);

-- Organization memberships table
CREATE TABLE IF NOT EXISTS "organization_memberships" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" varchar(255) NOT NULL REFERENCES "users"("user_id"),
  "organization_id" integer NOT NULL REFERENCES "organizations"("id"),
  "role" varchar(20) NOT NULL DEFAULT 'member',
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "org_memberships_user_org_unique" UNIQUE("user_id", "organization_id")
);

-- Board memberships table
CREATE TABLE IF NOT EXISTS "board_memberships" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" varchar(255) NOT NULL REFERENCES "users"("user_id"),
  "board_id" integer NOT NULL REFERENCES "boards"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "board_memberships_user_board_unique" UNIQUE("user_id", "board_id")
);

-- Step 2: Add board_id column to punches (nullable for now)
-- =========================================================
ALTER TABLE "punches" ADD COLUMN IF NOT EXISTS "board_id" integer REFERENCES "boards"("id");

-- Step 3: Create SCAROB organization and boards
-- =========================================================
INSERT INTO "organizations" ("name", "slug")
VALUES ('SCAROB', 'scarob')
ON CONFLICT ("slug") DO NOTHING;

-- Get the SCAROB org ID and create boards
DO $$
DECLARE
  scarob_org_id integer;
BEGIN
  SELECT "id" INTO scarob_org_id FROM "organizations" WHERE "slug" = 'scarob';
  
  -- Create Mentors board
  INSERT INTO "boards" ("organization_id", "name", "slug")
  VALUES (scarob_org_id, 'Mentors', 'mentors')
  ON CONFLICT ("organization_id", "slug") DO NOTHING;
  
  -- Create Students board
  INSERT INTO "boards" ("organization_id", "name", "slug")
  VALUES (scarob_org_id, 'Students', 'students')
  ON CONFLICT ("organization_id", "slug") DO NOTHING;
END $$;

-- Step 4: Migrate users from punches table
-- Extract unique users and determine admin status by email
-- =========================================================

-- Admin emails (from constants.ts)
-- jonathan.higger@gmail.com (also superadmin)
-- aionfork@gmail.com
-- armstrong.dan237@gmail.com
-- tarheelwinetraders@gmail.com
-- janyoumd@gmail.com
-- semoyer@vt.edu

-- Insert unique users from punches
INSERT INTO "users" ("user_id", "email", "name", "global_role")
SELECT DISTINCT ON (p."user_id")
  p."user_id",
  COALESCE(p."user_email", 'unknown@unknown.com'),
  p."user_name",
  CASE 
    WHEN p."user_email" = 'jonathan.higger@gmail.com' THEN 'superadmin'
    ELSE 'user'
  END
FROM "punches" p
WHERE p."user_id" IS NOT NULL
ON CONFLICT ("user_id") DO UPDATE SET
  "email" = COALESCE(EXCLUDED."email", "users"."email"),
  "name" = COALESCE(EXCLUDED."name", "users"."name");

-- Step 5: Create organization memberships
-- Admins get 'admin' role, others get 'member' role
-- =========================================================
DO $$
DECLARE
  scarob_org_id integer;
BEGIN
  SELECT "id" INTO scarob_org_id FROM "organizations" WHERE "slug" = 'scarob';
  
  -- Insert org memberships for all users
  INSERT INTO "organization_memberships" ("user_id", "organization_id", "role")
  SELECT 
    u."user_id",
    scarob_org_id,
    CASE 
      WHEN u."email" IN (
        'jonathan.higger@gmail.com',
        'aionfork@gmail.com',
        'armstrong.dan237@gmail.com',
        'tarheelwinetraders@gmail.com',
        'janyoumd@gmail.com',
        'semoyer@vt.edu'
      ) THEN 'admin'
      ELSE 'member'
    END
  FROM "users" u
  ON CONFLICT ("user_id", "organization_id") DO NOTHING;
END $$;

-- Step 6: Assign punches to boards
-- Admin punches → Mentors board
-- Non-admin punches → Students board
-- =========================================================
DO $$
DECLARE
  scarob_org_id integer;
  mentors_board_id integer;
  students_board_id integer;
BEGIN
  SELECT "id" INTO scarob_org_id FROM "organizations" WHERE "slug" = 'scarob';
  SELECT "id" INTO mentors_board_id FROM "boards" WHERE "organization_id" = scarob_org_id AND "slug" = 'mentors';
  SELECT "id" INTO students_board_id FROM "boards" WHERE "organization_id" = scarob_org_id AND "slug" = 'students';
  
  -- Update punches for admin users → Mentors board
  UPDATE "punches" p
  SET "board_id" = mentors_board_id
  FROM "users" u
  WHERE p."user_id" = u."user_id"
    AND u."email" IN (
      'jonathan.higger@gmail.com',
      'aionfork@gmail.com',
      'armstrong.dan237@gmail.com',
      'tarheelwinetraders@gmail.com',
      'janyoumd@gmail.com',
      'semoyer@vt.edu'
    );
  
  -- Update punches for non-admin users → Students board
  UPDATE "punches" p
  SET "board_id" = students_board_id
  WHERE p."board_id" IS NULL;
END $$;

-- Step 7: Create board memberships for non-admin users
-- Non-admins need explicit board membership to access Students board
-- Admins can access all boards via their org admin role
-- =========================================================
DO $$
DECLARE
  scarob_org_id integer;
  students_board_id integer;
BEGIN
  SELECT "id" INTO scarob_org_id FROM "organizations" WHERE "slug" = 'scarob';
  SELECT "id" INTO students_board_id FROM "boards" WHERE "organization_id" = scarob_org_id AND "slug" = 'students';
  
  -- Create board memberships for non-admin users to Students board
  INSERT INTO "board_memberships" ("user_id", "board_id")
  SELECT 
    om."user_id",
    students_board_id
  FROM "organization_memberships" om
  WHERE om."organization_id" = scarob_org_id
    AND om."role" = 'member'
  ON CONFLICT ("user_id", "board_id") DO NOTHING;
END $$;

-- Step 8: Make board_id NOT NULL now that all data is migrated
-- =========================================================
ALTER TABLE "punches" ALTER COLUMN "board_id" SET NOT NULL;

-- Step 9: Create indexes for performance
-- =========================================================
CREATE INDEX IF NOT EXISTS "idx_punches_board_id" ON "punches"("board_id");
CREATE INDEX IF NOT EXISTS "idx_punches_user_id" ON "punches"("user_id");
CREATE INDEX IF NOT EXISTS "idx_punches_timestamp" ON "punches"("timestamp");
CREATE INDEX IF NOT EXISTS "idx_org_memberships_user_id" ON "organization_memberships"("user_id");
CREATE INDEX IF NOT EXISTS "idx_org_memberships_org_id" ON "organization_memberships"("organization_id");
CREATE INDEX IF NOT EXISTS "idx_board_memberships_user_id" ON "board_memberships"("user_id");
CREATE INDEX IF NOT EXISTS "idx_board_memberships_board_id" ON "board_memberships"("board_id");
CREATE INDEX IF NOT EXISTS "idx_boards_org_id" ON "boards"("organization_id");
