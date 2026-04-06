-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "reporterUserId" TEXT NOT NULL,
    "reporterName" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reportedUserId" TEXT NOT NULL,
    "reportedName" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "contentSnapshot" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolvedByUserId" TEXT,
    "resolvedByName" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");
CREATE INDEX "reports_reporterUserId_idx" ON "reports"("reporterUserId");
CREATE INDEX "reports_reportedUserId_idx" ON "reports"("reportedUserId");
CREATE INDEX "reports_targetType_targetId_idx" ON "reports"("targetType", "targetId");
