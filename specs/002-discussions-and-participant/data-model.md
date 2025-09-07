# Data Model: Discussions and Participant Experience

**Feature**: Discussion creation and participant management  
**Date**: 2025-01-07  
**Status**: Complete

## Overview
This document describes the data model for the discussion and participant experience feature. All models already exist in the Prisma schema and require no migration.

## Core Entities

### Discussion
**Purpose**: Represents an AI-facilitated Socratic discussion room created from a lesson.

**Fields**:
- `id`: String (CUID) - Unique identifier
- `name`: String (max 100 chars) - Discussion title
- `description`: String? - Optional description
- `creatorId`: String - References User who created the discussion
- `isActive`: Boolean - Whether discussion accepts new messages
- `isPublic`: Boolean - Whether discussion is publicly visible
- `maxParticipants`: Int - Maximum allowed participants (default: 20)
- `joinCode`: String? - Optional 8-character code for joining
- `password`: String? - Optional password protection
- `scheduledFor`: DateTime? - When discussion is scheduled
- `expiresAt`: DateTime? - When discussion expires
- `lessonId`: String? - References the source Lesson
- `sourceGroupId`: String? - References Group if created from group
- `aiConfig`: Json - AI facilitator configuration
- `systemPrompt`: String? - Custom AI system prompt
- `createdAt`: DateTime - Creation timestamp
- `updatedAt`: DateTime - Last update timestamp
- `closedAt`: DateTime? - When discussion was closed

**Relationships**:
- `creator`: User (many-to-one)
- `lesson`: Lesson? (many-to-one)
- `sourceGroup`: Group? (many-to-one)
- `participants`: DiscussionParticipant[] (one-to-many)
- `messages`: Message[] (one-to-many)

**Business Rules**:
- Must be linked to a published lesson
- Creator automatically becomes CREATOR role participant
- Cannot be created before lesson release date
- Join code must be unique if provided
- Max participants enforced on join

### DiscussionParticipant (Cohort Membership)
**Purpose**: Tracks participants in a discussion, forming cohorts.

**Fields**:
- `id`: String (CUID) - Unique identifier
- `discussionId`: String - References Discussion
- `userId`: String - References User
- `role`: ParticipantRole - CREATOR, MODERATOR, or PARTICIPANT
- `status`: ParticipantStatus - ACTIVE, INACTIVE, REMOVED, or LEFT
- `joinedAt`: DateTime - When user joined
- `leftAt`: DateTime? - When user left
- `lastSeenAt`: DateTime - Last activity timestamp
- `messageCount`: Int - Number of messages sent

**Relationships**:
- `discussion`: Discussion (many-to-one)
- `user`: User (many-to-one)

**Business Rules**:
- Unique constraint on (discussionId, userId)
- User can only join once per discussion
- Status transitions: ACTIVE → INACTIVE → LEFT/REMOVED
- Message count increments on each message

### Message
**Purpose**: Stores conversation messages in discussions.

**Fields**:
- `id`: String (CUID) - Unique identifier
- `discussionId`: String - References Discussion
- `authorId`: String? - References User (null for AI)
- `content`: String - Message content
- `type`: MessageType - USER, AI_QUESTION, AI_PROMPT, SYSTEM, MODERATOR
- `parentId`: String? - For threaded replies
- `isEdited`: Boolean - Whether message was edited
- `editedAt`: DateTime? - When message was edited
- `createdAt`: DateTime - Creation timestamp

**Relationships**:
- `discussion`: Discussion (many-to-one)
- `author`: User? (many-to-one)
- `parent`: Message? (self-referential)
- `replies`: Message[] (self-referential)

**Business Rules**:
- AI messages have null authorId
- System messages for join/leave events
- Edit tracking for audit trail
- Threading optional via parentId

### Invitation
**Purpose**: Manages invitations to join discussions.

**Fields**:
- `id`: String (CUID) - Unique identifier
- `type`: InvitationType - DISCUSSION or GROUP
- `targetId`: String - ID of discussion or group
- `recipientEmail`: String - Invitee's email
- `recipientId`: String? - User ID if registered
- `senderId`: String - References inviter
- `message`: String? - Personal message
- `token`: String - Unique invitation token
- `status`: InvitationStatus - PENDING, ACCEPTED, DECLINED, EXPIRED, CANCELLED
- `expiresAt`: DateTime - Expiration timestamp
- `acceptedAt`: DateTime? - When accepted
- `declinedAt`: DateTime? - When declined
- `createdAt`: DateTime - Creation timestamp

**Relationships**:
- `sender`: User (many-to-one)
- `recipient`: User? (many-to-one)

**Business Rules**:
- Token must be unique
- Expires after 7 days by default
- Status transitions: PENDING → ACCEPTED/DECLINED/EXPIRED
- Creates user account on acceptance if needed

## Enumerations

### ParticipantRole
- `CREATOR`: Full control, can close discussion
- `MODERATOR`: Can remove participants, delete messages
- `PARTICIPANT`: Can view and post messages

### ParticipantStatus
- `ACTIVE`: Currently participating
- `INACTIVE`: Temporarily inactive
- `REMOVED`: Removed by moderator
- `LEFT`: Left voluntarily

### MessageType
- `USER`: Regular participant message
- `AI_QUESTION`: Socratic question from AI
- `AI_PROMPT`: AI facilitation prompt
- `SYSTEM`: System notification
- `MODERATOR`: Moderator action message

### InvitationStatus
- `PENDING`: Awaiting response
- `ACCEPTED`: Invitation accepted
- `DECLINED`: Invitation declined
- `EXPIRED`: Past expiration date
- `CANCELLED`: Cancelled by sender

## State Transitions

### Discussion Lifecycle
```
Created (isActive=true) → Active → Closed (isActive=false, closedAt set)
```

### Participant Status Flow
```
Invited → PENDING → Join → ACTIVE → INACTIVE → LEFT/REMOVED
```

### Invitation Status Flow
```
Created → PENDING → ACCEPTED/DECLINED/EXPIRED/CANCELLED
```

## Data Integrity Rules

1. **Referential Integrity**:
   - Cascade delete messages when discussion deleted
   - Restrict delete user if they created discussions
   - Set null on lesson deletion (preserve discussion)

2. **Unique Constraints**:
   - Discussion join codes globally unique
   - User can only participate once per discussion
   - Invitation tokens globally unique

3. **Required Relationships**:
   - Discussion must have creator
   - Participant must reference valid user and discussion
   - Message must belong to discussion

4. **Validation Rules**:
   - Discussion name max 100 characters
   - Join code exactly 8 characters if set
   - Max participants between 1-1000
   - Message content not empty

## Query Patterns

### Common Queries
1. **Get user's discussions**: Filter DiscussionParticipant by userId
2. **Get discussion participants**: Join DiscussionParticipant with User
3. **Get discussion messages**: Filter Message by discussionId, order by createdAt
4. **Check invitation validity**: Find by token, check status and expiry
5. **Count active participants**: Filter by discussionId and status=ACTIVE

### Indexes (Already in Schema)
- Discussion: creatorId, joinCode, (isActive, isPublic), lessonId
- DiscussionParticipant: userId, (discussionId, status)
- Message: (discussionId, createdAt), authorId, parentId
- Invitation: recipientEmail, recipientId, token, (type, targetId), (status, expiresAt)

## Migration Requirements
**None** - All models already exist in the current Prisma schema.

## Future Considerations
1. **Analytics**: Add view counts, engagement metrics
2. **Permissions**: More granular permission system
3. **Templates**: Discussion templates for common scenarios
4. **Archival**: Soft delete with archival system
5. **Export**: Discussion transcript export functionality