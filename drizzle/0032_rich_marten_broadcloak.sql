ALTER TABLE "users" ADD COLUMN "username" text;--> statement-breakpoint
WITH normalized AS (
  SELECT
    id,
    coalesce(
      nullif(
        regexp_replace(
          regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9._-]+', '-', 'g'),
          '(^[-._]+|[-._]+$)',
          '',
          'g'
        ),
        ''
      ),
      'user'
    ) AS base_username
  FROM "users"
),
deduplicated AS (
  SELECT
    id,
    base_username,
    row_number() OVER (PARTITION BY base_username ORDER BY id) AS duplicate_index
  FROM normalized
),
candidate_usernames AS (
  SELECT
    id,
    CASE
      WHEN duplicate_index = 1 THEN base_username
      ELSE base_username || '-' || duplicate_index::text
    END AS candidate_username
  FROM deduplicated
),
resolved_usernames AS (
  SELECT
    id,
    candidate_username,
    row_number() OVER (PARTITION BY candidate_username ORDER BY id) AS collision_index
  FROM candidate_usernames
)
UPDATE "users" AS user_row
SET "username" = CASE
  WHEN resolved_usernames.collision_index = 1 THEN resolved_usernames.candidate_username
  ELSE resolved_usernames.candidate_username || '-' || replace(user_row.id::text, '-', '')
END
FROM resolved_usernames
WHERE user_row.id = resolved_usernames.id;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "users_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");
