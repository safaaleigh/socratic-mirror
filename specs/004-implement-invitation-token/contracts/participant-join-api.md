# API Contract: Anonymous Participant Join

**Feature**: 004-implement-invitation-token  
**Endpoint**: `participant.join`  
**Type**: tRPC Mutation (Public)

## Request Schema

```typescript
{
  token: string, // Invitation token (CUID)
  participantName: string, // Display name for anonymous participant
  discussionId: string // Target discussion ID
}
```

### Validation Rules
- `token`: Required, valid CUID format
- `participantName`: Required, 1-50 characters, trimmed
- `discussionId`: Required, valid CUID format
- No authentication required for anonymous participation

## Response Schema

### Success Response
```typescript
{
  success: true,
  participant: {
    id: string, // Participant record ID
    participantName: string, // Confirmed name
    discussionId: string,
    joinedAt: Date
  },
  jwtToken: string // JWT token for anonymous session
}
```

### Success Example
```typescript
{
  success: true,
  participant: {
    id: "cm123participant456",
    participantName: "Alex Chen",
    discussionId: "cm123discussion789", 
    joinedAt: "2025-09-09T14:30:00Z"
  },
  jwtToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## Error Responses

### tRPC Error Format
```typescript
{
  error: {
    code: "BAD_REQUEST" | "NOT_FOUND" | "PRECONDITION_FAILED" | "FORBIDDEN",
    message: string
  }
}
```

### Error Cases
| Error Code | Message | Cause | User Action |
|------------|---------|--------|-------------|
| `BAD_REQUEST` | "Participant name is required" | Empty/invalid name | Show validation error |
| `NOT_FOUND` | "Invitation not found" | Invalid token | Show "Invalid link" |
| `NOT_FOUND` | "Discussion not found" | Invalid discussion ID | Show "Discussion unavailable" |
| `PRECONDITION_FAILED` | "Invitation has expired" | Past expiration | Show "Link expired" |
| `PRECONDITION_FAILED` | "Discussion is full" | Max participants reached | Show "Discussion full" |
| `PRECONDITION_FAILED` | "Discussion is not active" | Discussion closed | Show "Discussion closed" |
| `FORBIDDEN` | "Already joined this discussion" | Duplicate participation | Redirect to discussion |

## Business Logic

### Validation Flow
```typescript
// 1. Validate invitation token
const invitation = await validateInvitation(token);

// 2. Check discussion capacity and status
const discussion = await validateDiscussion(discussionId);

// 3. Check for existing participation
const existing = await checkExistingParticipant(discussionId, participantName);

// 4. Create participant record
const participant = await createAnonymousParticipant({
  discussionId,
  participantName,
  userId: null // Anonymous
});

// 5. Generate JWT session token
const jwtToken = await generateParticipantToken(participant);
```

### Atomic Operations
- Participant creation and invitation acceptance are in single transaction
- JWT token generation happens after successful database operations
- Rollback occurs if any step fails

## JWT Token Structure

### Payload
```typescript
{
  participantId: string,
  discussionId: string,
  participantName: string,
  isAnonymous: true,
  iat: number, // Issued at
  exp: number // Expires (24 hours default)
}
```

### Usage
- Used for WebSocket authentication
- Required for sending messages in discussion
- Stored in browser localStorage/sessionStorage
- Expires automatically for security

## Usage Examples

### Anonymous Join Flow
```typescript
const result = await trpc.participant.join.mutate({
  token: "cm123invitation456",
  participantName: "Alex Chen",
  discussionId: "cm123discussion789"
});

if (result.success) {
  // Store JWT token
  localStorage.setItem('participant_token', result.jwtToken);
  
  // Redirect to discussion
  router.push(`/discussion/${result.participant.discussionId}/participant`);
}
```

### Handle Validation Errors
```typescript
try {
  const result = await trpc.participant.join.mutate({
    token: "expired_token",
    participantName: "Alex Chen", 
    discussionId: "cm123discussion789"
  });
} catch (error) {
  switch (error.data?.code) {
    case "PRECONDITION_FAILED":
      if (error.message.includes("expired")) {
        showError("This invitation has expired");
      }
      break;
    case "BAD_REQUEST":
      showError("Please provide a valid name");
      break;
  }
}
```

## Performance Requirements

- **Response Time**: <1s for participant creation
- **JWT Generation**: <100ms for token creation
- **Concurrent Joins**: Handle multiple users joining simultaneously
- **Database Operations**: Single transaction for consistency

## Security Considerations

### Anonymous Safety
- No user authentication required
- Names validated but not unique (multiple "Alex" allowed)
- JWT tokens expire automatically
- No access to other discussions with same token

### Rate Limiting
- Limited to 5 join attempts per minute per IP
- Token-based rate limiting (same token can't be used rapidly)
- Invitation token consumption tracking

### Data Validation
- Participant name sanitized against XSS
- Discussion ID validated against database
- JWT token uses secure signing key from environment

---

**Contract Status**: Defined based on existing `participant.join` tRPC endpoint with anonymous support