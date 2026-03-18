-- Track Favourites
CREATE TABLE "track_favourites" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "track_favourites_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "track_favourites_userId_trackId_key" ON "track_favourites"("userId", "trackId");
CREATE INDEX "track_favourites_trackId_idx" ON "track_favourites"("trackId");
CREATE INDEX "track_favourites_userId_idx" ON "track_favourites"("userId");
ALTER TABLE "track_favourites" ADD CONSTRAINT "track_favourites_trackId_fkey"
    FOREIGN KEY ("trackId") REFERENCES "musician_tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Artist Follows
CREATE TABLE "artist_follows" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "artist_follows_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "artist_follows_followerId_artistId_key" ON "artist_follows"("followerId", "artistId");
CREATE INDEX "artist_follows_artistId_idx" ON "artist_follows"("artistId");
CREATE INDEX "artist_follows_followerId_idx" ON "artist_follows"("followerId");
ALTER TABLE "artist_follows" ADD CONSTRAINT "artist_follows_artistId_fkey"
    FOREIGN KEY ("artistId") REFERENCES "musician_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Music Notifications
CREATE TABLE "music_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "actorId" TEXT,
    "actorName" TEXT,
    "actorAvatar" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "music_notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "music_notifications_userId_isRead_idx" ON "music_notifications"("userId", "isRead");
CREATE INDEX "music_notifications_userId_createdAt_idx" ON "music_notifications"("userId", "createdAt");

-- Playlists
CREATE TABLE "playlists" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "description" TEXT,
    "coverUrl" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "trackCount" INTEGER NOT NULL DEFAULT 0,
    "totalPlays" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "playlists_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "playlists_userId_slug_key" ON "playlists"("userId", "slug");
CREATE INDEX "playlists_userId_idx" ON "playlists"("userId");
CREATE INDEX "playlists_isPublic_totalPlays_idx" ON "playlists"("isPublic", "totalPlays");
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "musician_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Playlist Tracks
CREATE TABLE "playlist_tracks" (
    "id" TEXT NOT NULL,
    "playlistId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "playlist_tracks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "playlist_tracks_playlistId_trackId_key" ON "playlist_tracks"("playlistId", "trackId");
CREATE INDEX "playlist_tracks_playlistId_position_idx" ON "playlist_tracks"("playlistId", "position");
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_playlistId_fkey"
    FOREIGN KEY ("playlistId") REFERENCES "playlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_trackId_fkey"
    FOREIGN KEY ("trackId") REFERENCES "musician_tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Discovery Settings: add featured type, artist, playlist columns
ALTER TABLE "discovery_settings" ADD COLUMN "featuredType" TEXT NOT NULL DEFAULT 'track';
ALTER TABLE "discovery_settings" ADD COLUMN "featuredArtistId" TEXT;
ALTER TABLE "discovery_settings" ADD COLUMN "featuredPlaylistId" TEXT;
