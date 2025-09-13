# API Contract: Invitation Details

**Feature**: 004-implement-invitation-token  
**Endpoint**: `invitation.getByToken`  
**Type**: tRPC Query (Public)

## Request Schema

```typescript
{
  token: string // CUID format invitation token
}
```

### Validation Rules
- `token`: Required, must be valid CUID format
- No authentication required (public endpoint)

## Response Schema

### Success Response
```typescript
{
  id: string,
  type: string, // "DISCUSSION"
  targetId: string, // Discussion ID
  recipientEmail: string,
  senderId: string,
  sender: {
    id: string,
    name: string | null,
    email: string
  },
  message: string | null, // Personal message from sender
  token: string,
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "CANCELLED",
  expiresAt: Date,
  acceptedAt: Date | null,
  declinedAt: Date | null,
  createdAt: Date
}
```

### Success Example
```typescript
{
  id: "cm123invitation456",
  type: "DISCUSSION", 
  targetId: "cm123discussion456",
  recipientEmail: "",
  senderId: "cm123user456",
  sender: {
    id: "cm123user456",
    name: "Dr. Sarah Wilson",
    email: "sarah@university.edu"
  },
  message: "Looking forward to your insights on this topic!",
  token: "cm123token456789",
  status: "PENDING",
  expiresAt: "2025-09-16T12:00:00Z",
  acceptedAt: null,
  declinedAt: null,
  createdAt: "2025-09-09T12:00:00Z"
}
```

## Error Responses

### tRPC Error Format
```typescript
{
  error: {
    code: "NOT_FOUND" | "PRECONDITION_FAILED",
    message: string
  }
}
```

### Error Cases
| Error Code | Message | Cause |
|------------|---------|--------|
| `NOT_FOUND` | "Invitation not found" | Invalid token |
| `PRECONDITION_FAILED` | "Invitation has expired" | Past expiration date |

## Data Privacy

### Information Exposed
- ✅ Sender name and email (for trust/context)
- ✅ Personal message (if provided)
- ✅ Expiration timestamp
- ✅ Invitation status

### Information Protected
- ❌ Discussion participant list
- ❌ Other invitation tokens
- ❌ Internal discussion details
- ❌ Recipient-specific data (for link-based invitations)

## Usage Examples

### Fetch Invitation Details
```typescript
const invitation = await trpc.invitation.getByToken.query({
  token: "cm123token456789"
});

// Use in UI
const senderName = invitation.sender.name || "Someone";
const personalMessage = invitation.message || "";
const discussionTitle = "Critical Thinking Workshop"; // From separate query
```

### Handle Not Found
```typescript
try {
  const invitation = await trpc.invitation.getByToken.query({
    token: "invalid_token"
  });
} catch (error) {
  if (error.data?.code === "NOT_FOUND") {
    // Show "Invalid invitation link" message
  }
}
```

## Performance Requirements

- **Response Time**: <300ms for invitation details fetch
- **Concurrent Access**: Multiple users can fetch same invitation
- **Cache Policy**: No caching due to expiration/status changes

## Security Considerations

### Access Control
- Public endpoint - no authentication required
- Token itself provides access control
- Rate limiting applied at tRPC layer

### Data Sanitization
- Personal messages are stored as-is (no HTML)
- Email addresses shown for trust indicators
- No SQL injection risk (Prisma ORM handles escaping)

### Token Validation
- Server validates token format before database query
- Expired invitations still return details (for user feedback)
- Status changes are reflected immediately

---

**Contract Status**: Defined based on existing `invitation.getByToken` tRPC endpoint