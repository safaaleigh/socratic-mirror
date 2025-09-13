# Data Model: Invitation Token Handler Page

**Feature**: 004-implement-invitation-token  
**Date**: 2025-09-09

## Overview

This feature reuses existing Prisma models from the codebase and does not introduce new data models. All entities are already defined and functional.

## Existing Entities Used

### Invitation (Existing)
**Purpose**: Stores invitation tokens and metadata  
**Location**: Already defined in `prisma/schema.prisma`

**Key Fields**:
- `id: String` - Unique identifier (CUID)
- `token: String` - Unique token for invitation links (CUID) 
- `type: String` - Type of invitation ("DISCUSSION")
- `targetId: String` - Discussion ID being invited to
- `recipientEmail: String` - Email address (empty for link-based invitations)
- `recipientId: String?` - User ID if recipient exists (nullable)
- `senderId: String` - Creator of the invitation
- `message: String?` - Optional personal message (nullable)
- `status: InvitationStatus` - Current state (PENDING, ACCEPTED, DECLINED, EXPIRED, CANCELLED)
- `expiresAt: DateTime` - When invitation expires
- `acceptedAt: DateTime?` - When invitation was accepted (nullable)
- `declinedAt: DateTime?` - When invitation was declined (nullable)
- `createdAt: DateTime` - Creation timestamp

**State Transitions**:
```
PENDING → ACCEPTED (via invitation acceptance)
PENDING → EXPIRED (via time-based expiration)
PENDING → CANCELLED (via sender cancellation)
```

**Validation Rules**:
- Token must be unique across all invitations
- ExpiresAt must be future date when created
- Status changes follow valid state transitions only
- TargetId must reference valid Discussion

### Discussion (Existing)
**Purpose**: Target discussions for invitations  
**Location**: Already defined in `prisma/schema.prisma`

**Key Fields Used**:
- `id: String` - Discussion identifier
- `name: String` - Discussion title (displayed to invitees)
- `description: String?` - Discussion description (displayed if available)
- `isActive: Boolean` - Whether discussion accepts new participants
- `maxParticipants: Int?` - Maximum allowed participants (nullable = unlimited)
- `creatorId: String` - Discussion creator

**Relationships**:
- Has many Participants through DiscussionParticipant
- Has many Invitations

### DiscussionParticipant (Existing)
**Purpose**: Links users to discussions as participants  
**Location**: Already defined in `prisma/schema.prisma`

**Key Fields Used**:
- `id: String` - Unique identifier
- `discussionId: String` - Discussion reference
- `userId: String?` - User reference (nullable for anonymous)
- `participantName: String?` - Name for anonymous participants
- `role: ParticipantRole` - Role in discussion (PARTICIPANT, MODERATOR, CREATOR)
- `status: ParticipantStatus` - Current status (ACTIVE, INACTIVE, BANNED)
- `joinedAt: DateTime` - When user joined

**Anonymous Participant Support**:
- When `userId` is null, participant is anonymous
- `participantName` stores the name provided by anonymous user
- Anonymous participants get PARTICIPANT role by default

### User (Existing - Optional)
**Purpose**: Authenticated users (optional for this feature)  
**Location**: Already defined in `prisma/schema.prisma`

**Key Fields Used**:
- `id: String` - User identifier
- `name: String?` - Display name
- `email: String` - Email address

## Data Flow Patterns

### 1. Token Validation Flow
```typescript
// Input: token from URL parameter
const invitation = await db.invitation.findUnique({
  where: { token },
  include: { 
    sender: { select: { name: true, email: true } }
  }
})

// Validation checks:
// - Invitation exists
// - Not expired (expiresAt > now)
// - Status is PENDING
// - Target discussion is active
```

### 2. Anonymous Participation Flow
```typescript
// Create anonymous participant
await db.discussionParticipant.create({
  data: {
    discussionId: invitation.targetId,
    userId: null, // Anonymous
    participantName: userProvidedName,
    role: "PARTICIPANT",
    status: "ACTIVE"
  }
})

// Update invitation status
await db.invitation.update({
  where: { id: invitation.id },
  data: {
    status: "ACCEPTED",
    acceptedAt: new Date()
  }
})
```

### 3. Authenticated User Flow
```typescript
// Create authenticated participant
await db.discussionParticipant.create({
  data: {
    discussionId: invitation.targetId,
    userId: session.user.id, // From NextAuth
    participantName: null, // Use User.name instead
    role: "PARTICIPANT", 
    status: "ACTIVE"
  }
})
```

## Error Conditions

### Invalid Token States
- **Not Found**: Token doesn't exist in database
- **Expired**: `expiresAt < new Date()`
- **Already Used**: `status !== 'PENDING'`
- **Cancelled**: `status === 'CANCELLED'`

### Discussion States  
- **Inactive**: `discussion.isActive === false`
- **Full**: `participants.length >= maxParticipants` (when maxParticipants is set)

### Validation Failures
- **Empty Name**: Anonymous user provides empty/whitespace name
- **Duplicate Participation**: User already participant in discussion
- **Network Errors**: Database connectivity issues

## Performance Considerations

### Database Queries
- **Token Lookup**: Single query with join to sender info
- **Discussion Validation**: Include participant count in query
- **Participation Check**: Query existing participants before creating new one

### Indexing (Existing)
- Invitation.token has unique index
- DiscussionParticipant has composite index on discussionId + userId
- Discussion.id has primary key index

## Security Model

### Token Security
- Tokens are cryptographically secure CUIDs
- Server-side validation only (no client-side token parsing)
- Automatic expiration handling

### Anonymous Safety
- No sensitive data exposure to anonymous users
- Name validation prevents injection attacks
- Rate limiting inherited from tRPC layer

### Access Control
- No authentication required for viewing invitation details
- Participation creation uses transaction for consistency
- Invitation acceptance is idempotent (safe to retry)

---

**Status**: Data model analysis complete, using existing entities with no schema changes required