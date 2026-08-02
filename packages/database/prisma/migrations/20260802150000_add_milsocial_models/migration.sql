-- CreateEnum
CREATE TYPE "SocialPostFormat" AS ENUM ('UNCLASSIFIED', 'REDESIGN', 'BEFORE_AFTER', 'TIMELAPSE', 'REVIEW', 'ANIMATION', 'CODE_SETUP', 'OTHER');

-- CreateEnum
CREATE TYPE "SocialFormatSource" AS ENUM ('NONE', 'AI', 'MANUAL');

-- CreateTable
CREATE TABLE "SocialPost" (
    "id" TEXT NOT NULL,
    "igMediaId" TEXT NOT NULL,
    "igPermalink" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "caption" TEXT,
    "thumbnailUrl" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "format" "SocialPostFormat" NOT NULL DEFAULT 'UNCLASSIFIED',
    "formatSource" "SocialFormatSource" NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialMetricSnapshot" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reach" INTEGER,
    "views" INTEGER,
    "avgWatchTimeMs" INTEGER,
    "totalWatchTimeMs" BIGINT,
    "likes" INTEGER,
    "comments" INTEGER,
    "saved" INTEGER,
    "shares" INTEGER,
    "profileVisits" INTEGER,
    "profileActivity" INTEGER,

    CONSTRAINT "SocialMetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "accessToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SocialPost_igMediaId_key" ON "SocialPost"("igMediaId");

-- CreateIndex
CREATE INDEX "SocialPost_publishedAt_idx" ON "SocialPost"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SocialMetricSnapshot_postId_collectedAt_key" ON "SocialMetricSnapshot"("postId", "collectedAt");

-- CreateIndex
CREATE INDEX "SocialMetricSnapshot_collectedAt_idx" ON "SocialMetricSnapshot"("collectedAt");

-- AddForeignKey
ALTER TABLE "SocialMetricSnapshot" ADD CONSTRAINT "SocialMetricSnapshot_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
