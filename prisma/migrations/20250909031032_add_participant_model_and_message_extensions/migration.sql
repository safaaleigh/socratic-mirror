-- CreateEnum
CREATE TYPE "public"."MessageSenderType" AS ENUM ('USER', 'PARTICIPANT', 'SYSTEM');

-- AlterTable
ALTER TABLE "public"."Discussion" ADD COLUMN     "invitationToken" TEXT,
ALTER COLUMN "maxParticipants" DROP NOT NULL,
ALTER COLUMN "maxParticipants" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."Message" ADD COLUMN     "participantId" TEXT,
ADD COLUMN     "senderName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "senderType" "public"."MessageSenderType" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "public"."Participant" (
    "id" TEXT NOT NULL,
    "discussionId" TEXT NOT NULL,
    "displayName" VARCHAR(50) NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "sessionId" VARCHAR(255) NOT NULL,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Participant_discussionId_idx" ON "public"."Participant"("discussionId");

-- CreateIndex
CREATE INDEX "Participant_sessionId_idx" ON "public"."Participant"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_discussionId_sessionId_key" ON "public"."Participant"("discussionId", "sessionId");

-- AddForeignKey
ALTER TABLE "public"."Participant" ADD CONSTRAINT "Participant_discussionId_fkey" FOREIGN KEY ("discussionId") REFERENCES "public"."Discussion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "public"."Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
