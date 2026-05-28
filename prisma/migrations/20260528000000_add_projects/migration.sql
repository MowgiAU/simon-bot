-- Project versioning system (Fuji Studio Desktop Sync)
-- Adds 5 tables: projects, project_versions, project_file_entries,
-- project_file_blobs, project_track_links.

-- CreateTable: projects
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "arrangement" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable: project_versions
CREATE TABLE "project_versions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "message" TEXT,
    "totalFiles" INTEGER NOT NULL DEFAULT 0,
    "totalSize" BIGINT NOT NULL DEFAULT 0,
    "arrangement" JSONB,
    "isParsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: project_file_entries
CREATE TABLE "project_file_entries" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "isDirectory" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "project_file_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable: project_file_blobs
CREATE TABLE "project_file_blobs" (
    "hash" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT,
    "refCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_file_blobs_pkey" PRIMARY KEY ("hash")
);

-- CreateTable: project_track_links
CREATE TABLE "project_track_links" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_track_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: projects
CREATE UNIQUE INDEX "projects_userId_slug_key" ON "projects"("userId", "slug");
CREATE INDEX "projects_userId_idx" ON "projects"("userId");

-- CreateIndex: project_versions
CREATE UNIQUE INDEX "project_versions_projectId_versionNumber_key" ON "project_versions"("projectId", "versionNumber");
CREATE INDEX "project_versions_projectId_idx" ON "project_versions"("projectId");

-- CreateIndex: project_file_entries
CREATE UNIQUE INDEX "project_file_entries_versionId_filePath_key" ON "project_file_entries"("versionId", "filePath");
CREATE INDEX "project_file_entries_fileHash_idx" ON "project_file_entries"("fileHash");

-- CreateIndex: project_track_links
CREATE UNIQUE INDEX "project_track_links_trackId_key" ON "project_track_links"("trackId");
CREATE INDEX "project_track_links_projectId_idx" ON "project_track_links"("projectId");
CREATE INDEX "project_track_links_trackId_idx" ON "project_track_links"("trackId");

-- AddForeignKey: projects -> users
ALTER TABLE "projects"
    ADD CONSTRAINT "projects_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: project_versions -> projects
ALTER TABLE "project_versions"
    ADD CONSTRAINT "project_versions_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: project_file_entries -> project_versions
ALTER TABLE "project_file_entries"
    ADD CONSTRAINT "project_file_entries_versionId_fkey"
    FOREIGN KEY ("versionId") REFERENCES "project_versions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: project_track_links -> projects
ALTER TABLE "project_track_links"
    ADD CONSTRAINT "project_track_links_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: project_track_links -> project_versions
ALTER TABLE "project_track_links"
    ADD CONSTRAINT "project_track_links_versionId_fkey"
    FOREIGN KEY ("versionId") REFERENCES "project_versions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: project_track_links -> musician_tracks
ALTER TABLE "project_track_links"
    ADD CONSTRAINT "project_track_links_trackId_fkey"
    FOREIGN KEY ("trackId") REFERENCES "musician_tracks"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
