# Data Model: Participant View

## Core Entities

### Discussion (Extended)
**Purpose**: Represents a Socratic discussion session that can accept participants via invitation links

**Fields**:
- `id: string` (existing) - Unique identifier
- `title: string` (existing) - Discussion title
- `status: DiscussionStatus` (existing) - active | completed | cancelled  
- `createdAt: DateTime` (existing) - Creation timestamp
- `updatedAt: DateTime` (existing) - Last modification timestamp
- `createdBy: string` (existing) - User ID of discussion creator
- `lessonId: string` (existing) - Associated lesson
- **NEW**: `invitationToken: string?` - JWT token for invitation links (nullable, generated on demand)
- **NEW**: `maxParticipants: number?` - Optional participant limit (null = unlimited)

**Relationships**:
- `lesson: Lesson` (existing) - Associated lesson
- `messages: Message[]` (existing) - Discussion messages
- **NEW**: `participants: Participant[]` - Active participants

**Validation Rules**:
- Only `active` discussions can accept new participants
- `invitationToken` must be valid JWT when provided
- `maxParticipants` must be positive if set

**State Transitions**:
```
active → completed (by creator)
active → cancelled (by creator)  
completed/cancelled → [final states]
```

### Participant (New Entity)
**Purpose**: Represents an anonymous participant in a discussion (no user account required)

**Fields**:
- `id: string` - Unique identifier (UUID)
- `discussionId: string` - Foreign key to discussion
- `displayName: string` - Participant-chosen name
- `joinedAt: DateTime` - When participant joined
- `leftAt: DateTime?` - When participant left (null if still active)
- `ipAddress: string?` - IP for basic moderation (optional)
- `sessionId: string` - Browser session identifier

**Relationships**:
- `discussion: Discussion` - Parent discussion
- `messages: Message[]` - Messages sent by this participant

**Validation Rules**:
- `displayName` must be 1-50 characters
- `displayName` cannot contain only whitespace
- Duplicate names allowed within same discussion
- `sessionId` must be unique per discussion

### Message (Extended) 
**Purpose**: Represents a message in the discussion, supporting both authenticated users and anonymous participants

**Fields**:
- `id: string` (existing) - Unique identifier
- `discussionId: string` (existing) - Foreign key to discussion
- `content: string` (existing) - Message content
- `createdAt: DateTime` (existing) - Creation timestamp
- `userId: string?` (existing) - User ID if sent by authenticated user (nullable)
- **NEW**: `participantId: string?` - Participant ID if sent by anonymous participant (nullable)
- **NEW**: `senderName: string` - Display name of sender (denormalized for performance)
- **NEW**: `senderType: MessageSenderType` - 'user' | 'participant' | 'system'

**Relationships**:
- `discussion: Discussion` (existing) - Parent discussion
- `user: User?` (existing) - Authenticated sender (nullable)
- **NEW**: `participant: Participant?` - Anonymous sender (nullable)

**Validation Rules**:
- Exactly one of `userId` or `participantId` must be set (not both, not neither)
- `content` must be 1-5000 characters
- `senderName` derived from user.name or participant.displayName
- `senderType` must match the sender (user vs participant vs system)

## Database Schema Changes

### New Tables

```sql
-- Participants table
CREATE TABLE "Participant" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "discussionId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leftAt" DATETIME,
  "ipAddress" TEXT,
  "sessionId" TEXT NOT NULL,
  
  CONSTRAINT "Participant_discussionId_fkey" 
    FOREIGN KEY ("discussionId") REFERENCES "Discussion" ("id") 
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes for performance
CREATE INDEX "Participant_discussionId_idx" ON "Participant"("discussionId");
CREATE INDEX "Participant_sessionId_idx" ON "Participant"("sessionId");
CREATE UNIQUE INDEX "Participant_discussionId_sessionId_key" 
  ON "Participant"("discussionId", "sessionId");
```

### Modified Tables

```sql
-- Add columns to existing Discussion table
ALTER TABLE "Discussion" 
ADD COLUMN "invitationToken" TEXT,
ADD COLUMN "maxParticipants" INTEGER;

-- Add columns to existing Message table  
ALTER TABLE "Message"
ADD COLUMN "participantId" TEXT,
ADD COLUMN "senderName" TEXT NOT NULL DEFAULT '',
ADD COLUMN "senderType" TEXT NOT NULL DEFAULT 'user';

-- Add foreign key constraint for participantId
ALTER TABLE "Message" 
ADD CONSTRAINT "Message_participantId_fkey" 
  FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") 
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Add constraint to ensure exactly one sender type
ALTER TABLE "Message" 
ADD CONSTRAINT "Message_sender_check" 
  CHECK (
    ("userId" IS NOT NULL AND "participantId" IS NULL) OR
    ("userId" IS NULL AND "participantId" IS NOT NULL)
  );
```

## Prisma Schema Updates

```typescript
model Discussion {
  id              String            @id @default(cuid())
  title           String
  status          DiscussionStatus
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  createdBy       String
  lessonId        String
  invitationToken String?           // New field
  maxParticipants Int?              // New field
  
  lesson        Lesson        @relation(fields: [lessonId], references: [id])
  user          User          @relation(fields: [createdBy], references: [id])
  messages      Message[]
  participants  Participant[] // New relation
}

model Participant {
  id           String    @id @default(cuid())
  discussionId String
  displayName  String
  joinedAt     DateTime  @default(now())
  leftAt       DateTime?
  ipAddress    String?
  sessionId    String
  
  discussion Discussion @relation(fields: [discussionId], references: [id], onDelete: Cascade)
  messages   Message[]
  
  @@unique([discussionId, sessionId])
  @@index([discussionId])
}

model Message {
  id            String            @id @default(cuid())
  discussionId  String
  content       String
  createdAt     DateTime          @default(now())
  userId        String?           // Existing, nullable
  participantId String?           // New, nullable  
  senderName    String            // New, denormalized
  senderType    MessageSenderType // New enum
  
  discussion  Discussion   @relation(fields: [discussionId], references: [id])
  user        User?        @relation(fields: [userId], references: [id])
  participant Participant? @relation(fields: [participantId], references: [id]) // New relation
  
  @@index([discussionId])
  @@index([createdAt])
}

enum MessageSenderType {
  user
  participant  
  system
}
```

## Migration Strategy

1. **Phase 1**: Add new nullable columns to existing tables
2. **Phase 2**: Create Participant table with constraints  
3. **Phase 3**: Backfill existing messages with `senderType = 'user'` and populate `senderName`
4. **Phase 4**: Add non-null constraints where appropriate

## Performance Considerations

- **Message History**: Index on `(discussionId, createdAt)` for efficient pagination
- **Participant Lookup**: Unique index on `(discussionId, sessionId)` for fast participant resolution
- **Denormalization**: `senderName` stored on messages to avoid joins during message rendering
- **Cleanup**: Background job to mark participants as left after session timeout

## Data Integrity

- **Cascade Deletes**: Participants deleted when discussion deleted
- **Orphan Prevention**: Messages retain participant info even if participant record cleaned up
- **Session Uniqueness**: One participant record per session per discussion
- **Invitation Security**: JWT tokens include discussion ID and expiration