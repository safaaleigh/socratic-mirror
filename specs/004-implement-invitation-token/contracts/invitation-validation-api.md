# API Contract: Invitation Validation

**Feature**: 004-implement-invitation-token  
**Endpoint**: `invitation.validate`  
**Type**: tRPC Query

## Request Schema

```typescript
{
  token: string // CUID format invitation token
}
```

### Validation Rules
- `token`: Required, must be valid CUID format
- Length: Exactly CUID length (25 characters)
- Characters: Alphanumeric only

## Response Schema

### Success Response
```typescript
{
  valid: boolean,
  discussion?: {
    id: string,
    name: string,
    participantCount: number,
    maxParticipants: number | null
  }
}
```

### Valid Invitation Response
```typescript
{
  valid: true,
  discussion: {
    id: "cuid_discussion_id",
    name: "Discussion Title",
    participantCount: 5,
    maxParticipants: 10 // or null for unlimited
  }
}
```

### Invalid Invitation Response  
```typescript
{
  valid: false,
  reason: string // One of predefined error messages
}
```

## Error States

### Validation Errors
| Reason | Description | User Action |
|--------|-------------|-------------|
| "Invitation not found" | Token doesn't exist | Show "Invalid link" message |
| "Invitation has expired" | Past expiration date | Show "Link expired" message |
| "Invitation is accepted" | Already used | Show "Link already used" message |  
| "Invitation is cancelled" | Cancelled by sender | Show "Invitation cancelled" message |
| "Discussion is not active" | Discussion closed | Show "Discussion closed" message |
| "Discussion is full" | Max participants reached | Show "Discussion full" message |

### HTTP Error Codes
- `400 Bad Request` - Invalid token format
- `404 Not Found` - Token doesn't exist  
- `500 Internal Server Error` - Database errors

## Usage Examples

### Valid Token Check
```typescript
const result = await trpc.invitation.validate.query({
  token: "cm123abc456def789ghi012jkl"
});

if (result.valid) {
  // Show invitation details with accept option
  console.log(`Join "${result.discussion.name}"`);
} else {
  // Show error message
  console.error(result.reason);
}
```

### Expired Token Handling
```typescript
const result = await trpc.invitation.validate.query({
  token: "expired_token_here"
});

// Response: { valid: false, reason: "Invitation has expired" }
```

## Performance Requirements

- **Response Time**: <500ms for token validation
- **Throughput**: Support concurrent validation requests
- **Caching**: No caching (tokens may expire, discussions may fill)

## Security Considerations

- **Token Exposure**: Tokens in URL are visible in logs/referrers
- **Rate Limiting**: Inherit from tRPC layer rate limiting
- **Validation**: Server-side only, no client-side token validation
- **Information Disclosure**: Error messages don't reveal sensitive data

---

**Contract Status**: Defined based on existing `invitation.validate` tRPC endpoint