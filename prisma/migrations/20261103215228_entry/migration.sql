-- CreateTable
CREATE TABLE "Entry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "modality" TEXT NOT NULL,
    "textContent" TEXT NOT NULL DEFAULT '',
    "transcriptPending" BOOLEAN NOT NULL DEFAULT false,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "dayKey" TEXT NOT NULL,
    "audioUrl" TEXT,
    "audioType" TEXT,
    "audioSize" INTEGER,
    "photoUrl" TEXT,
    "photoType" TEXT,
    "photoSize" INTEGER,

    CONSTRAINT "Entry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Entry_userId_updatedAt_idx" ON "Entry"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Entry_userId_dayKey_idx" ON "Entry"("userId", "dayKey");

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
