-- CreateTable
CREATE TABLE "download_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT,
    "trackId" TEXT,
    "fileType" TEXT NOT NULL,
    "fileName" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "download_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "download_logs_userId_idx" ON "download_logs"("userId");

-- CreateIndex
CREATE INDEX "download_logs_trackId_idx" ON "download_logs"("trackId");

-- CreateIndex
CREATE INDEX "download_logs_createdAt_idx" ON "download_logs"("createdAt");
