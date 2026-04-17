WITH ranked_memberships AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY ranch_id, animal_id
      ORDER BY joined_at DESC, created_at DESC, id DESC
    ) AS rank_order
  FROM "animal_group_memberships"
  WHERE "is_active" = true
)
UPDATE "animal_group_memberships" AS memberships
SET
  "is_active" = false,
  "left_at" = coalesce(memberships."left_at", now()),
  "membership_note" = coalesce(
    memberships."membership_note",
    'Auto-resolved duplicate active herd-group membership during migration 0026.'
  )
FROM ranked_memberships AS ranked
WHERE memberships."id" = ranked."id"
  AND ranked.rank_order > 1;--> statement-breakpoint
CREATE UNIQUE INDEX "animal_group_memberships_animal_active_uidx" ON "animal_group_memberships" USING btree ("ranch_id","animal_id") WHERE "animal_group_memberships"."is_active" = true;
