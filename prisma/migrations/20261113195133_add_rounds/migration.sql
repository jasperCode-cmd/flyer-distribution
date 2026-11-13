-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL,
    "business" "Business" NOT NULL DEFAULT 'FDH',
    "leadId" TEXT,
    "projectId" TEXT,
    "distributorId" TEXT,
    "date" DATE NOT NULL,
    "notes" TEXT,
    "distanceM" INTEGER,
    "sectors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoundScreenshot" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "blobUrl" TEXT,
    "contentType" TEXT,
    "bytes" INTEGER,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sourceSha256" TEXT,
    "originalName" TEXT,
    "takenAt" TIMESTAMP(3),
    "crop" JSONB,
    "alignment" JSONB,
    "route" JSONB,
    "markers" JSONB,
    "routeLengthM" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoundScreenshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteReportLink" (
    "id" TEXT NOT NULL,
    "roundId" TEXT,
    "leadId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "lastViewedAt" TIMESTAMP(3),

    CONSTRAINT "RouteReportLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Round_date_idx" ON "Round"("date");

-- CreateIndex
CREATE INDEX "Round_leadId_idx" ON "Round"("leadId");

-- CreateIndex
CREATE INDEX "Round_projectId_idx" ON "Round"("projectId");

-- CreateIndex
CREATE INDEX "Round_distributorId_idx" ON "Round"("distributorId");

-- CreateIndex
CREATE INDEX "Round_business_idx" ON "Round"("business");

-- CreateIndex
CREATE INDEX "RoundScreenshot_roundId_idx" ON "RoundScreenshot"("roundId");

-- CreateIndex
CREATE UNIQUE INDEX "RouteReportLink_tokenHash_key" ON "RouteReportLink"("tokenHash");

-- CreateIndex
CREATE INDEX "RouteReportLink_roundId_idx" ON "RouteReportLink"("roundId");

-- CreateIndex
CREATE INDEX "RouteReportLink_leadId_idx" ON "RouteReportLink"("leadId");

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AreaProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundScreenshot" ADD CONSTRAINT "RoundScreenshot_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteReportLink" ADD CONSTRAINT "RouteReportLink_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteReportLink" ADD CONSTRAINT "RouteReportLink_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddCheckConstraint (added by hand; Prisma has no syntax for it): a report
-- link covers exactly one round or one lead, never both and never neither.
ALTER TABLE "RouteReportLink" ADD CONSTRAINT "RouteReportLink_one_scope_check" CHECK (num_nonnulls("roundId", "leadId") = 1);
