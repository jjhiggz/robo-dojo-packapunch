-- Drop the old songs table
DROP TABLE IF EXISTS "songs";

-- Create the punches table
CREATE TABLE IF NOT EXISTS "punches" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" varchar(255) NOT NULL,
  "user_name" varchar(255),
  "user_email" varchar(255),
  "type" varchar(10) NOT NULL,
  "timestamp" timestamp DEFAULT now() NOT NULL
);

