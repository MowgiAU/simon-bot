-- Performance indexes for faster profile and track lookups

-- Index on username for case-insensitive profile lookups (most common profile lookup path)
CREATE INDEX IF NOT EXISTS "musician_profiles_username_idx" ON "musician_profiles"("username");

-- Index on track slug for track detail page lookups
CREATE INDEX IF NOT EXISTS "musician_tracks_slug_idx" ON "musician_tracks"("slug");

-- Index on genreId for profile genre join (allows fast 'profiles by genre' queries on discovery page)
CREATE INDEX IF NOT EXISTS "profile_genres_genreId_idx" ON "profile_genres"("genreId");

-- Index on genreId for track genre join
CREATE INDEX IF NOT EXISTS "track_genres_genreId_idx" ON "track_genres"("genreId");
