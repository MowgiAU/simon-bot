-- Backfill slugs for tracks created by the BattleEntry-to-Track migration.
-- Those rows were inserted with id like 'be_<uuid>' and slug=NULL.
-- We assign a slug derived from the title, with a uniqueness suffix on the off
-- chance the same producer has multiple battle entries with the same title.

DO $$
DECLARE
    r RECORD;
    base_slug TEXT;
    candidate TEXT;
    suffix INT;
BEGIN
    FOR r IN
        SELECT id, "profileId", title
          FROM musician_tracks
         WHERE id LIKE 'be\_%' ESCAPE '\'
           AND (slug IS NULL OR slug = '')
    LOOP
        -- title -> lowercase, strip non-alnum, collapse dashes, trim dashes
        base_slug := lower(coalesce(r.title, ''));
        base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
        base_slug := regexp_replace(base_slug, '(^-|-$)', '', 'g');
        IF base_slug = '' THEN
            base_slug := 'battle-entry';
        END IF;

        candidate := base_slug;
        suffix := 1;

        -- Resolve collisions within the same profile
        WHILE EXISTS (
            SELECT 1
              FROM musician_tracks t
             WHERE t."profileId" = r."profileId"
               AND t.slug = candidate
               AND t.id <> r.id
        ) LOOP
            suffix := suffix + 1;
            candidate := base_slug || '-' || suffix;
        END LOOP;

        UPDATE musician_tracks
           SET slug = candidate
         WHERE id = r.id;
    END LOOP;
END $$;
