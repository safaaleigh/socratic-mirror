# Research: Discussions and Participant Experience

**Feature**: Creating discussions from lessons with participant invitations  
**Date**: 2025-01-07  
**Status**: Complete

## Executive Summary
This document outlines the technical decisions for implementing the discussion and participant experience feature. All unknowns from the specification have been researched and resolved.

## Technical Decisions

### 1. Real-time Messaging Implementation

**Decision**: tRPC Subscriptions with WebSockets  
**Rationale**: 
- Native tRPC support for subscriptions
- Type-safe real-time updates
- Integrates seamlessly with existing tRPC setup
- Lower latency than polling

**Alternatives Considered**:
- Server-Sent Events: One-way only, not suitable for bidirectional messaging
- Polling: Higher latency, more server load
- Separate WebSocket server: Additional complexity, loses type safety

**Implementation Notes**:
- Use `@trpc/server/adapters/ws` for WebSocket support
- Implement subscription procedures in message router
- Client-side: Use tRPC subscription hooks

### 2. Email Service Integration

**Decision**: Resend  
**Rationale**:
- Modern API designed for developers
- React Email template support
- Good deliverability rates
- Simple integration with Next.js
- Generous free tier (3,000 emails/month)

**Alternatives Considered**:
- SendGrid: More complex, enterprise-focused
- AWS SES: Requires more configuration
- Nodemailer with SMTP: Less reliable deliverability

**Implementation Notes**:
- Use `resend` npm package
- Create React Email templates for invitations
- Store API key in environment variables

### 3. AI Facilitation Integration

**Decision**: OpenAI API with GPT-4  
**Rationale**:
- Industry standard for conversational AI
- Excellent Socratic dialogue capabilities
- Function calling for structured responses
- Streaming support for real-time feel

**Alternatives Considered**:
- Anthropic Claude: Excellent but less ecosystem support
- Local LLMs: Not suitable for production scale
- Google Gemini: Less mature API

**Implementation Notes**:
- Use `openai` npm package
- Implement streaming responses
- Store API key securely
- Use system prompts based on lesson content

### 4. Invitation Security

**Decision**: Cryptographically secure tokens with expiration  
**Rationale**:
- CUID for unpredictable token generation
- Time-based expiration for security
- Database validation for each use
- One-time use tokens

**Alternatives Considered**:
- JWT tokens: Stateless but harder to revoke
- UUID: Less secure than CUID
- Simple random strings: Not cryptographically secure

**Implementation Notes**:
- Already using CUID in Prisma schema
- 7-day default expiration
- Check expiration on validation
- Mark as used after acceptance

### 5. Access Control Pattern

**Decision**: Role-based with Prisma relations  
**Rationale**:
- Already defined in Prisma schema
- Clear separation of concerns
- Easy to query and validate
- Supports future expansion

**Roles Defined**:
- CREATOR: Full control over discussion
- MODERATOR: Can manage participants
- PARTICIPANT: Can view and post messages

### 6. Message Storage and Threading

**Decision**: Flat structure with optional parent reference  
**Rationale**:
- Simple to query and display
- Supports threading if needed
- Efficient for real-time updates
- Already defined in schema

**Implementation Notes**:
- Store all messages in Message table
- Use parentId for replies
- Index on discussionId and createdAt

### 7. Cohort Management

**Decision**: Automatic cohort creation per discussion  
**Rationale**:
- Simplifies participant grouping
- Each discussion is its own cohort
- Supports multiple cohort membership
- Aligns with specification requirements

**Implementation Notes**:
- Use DiscussionParticipant as cohort membership
- Track join/leave timestamps
- Support participant limits

## Infrastructure Requirements

### Environment Variables Needed
```env
# Email Service
RESEND_API_KEY=

# AI Service  
OPENAI_API_KEY=

# WebSocket (if separate port needed)
WS_PORT=3001

# Invitation Settings
INVITATION_EXPIRY_DAYS=7
```

### Package Dependencies
```json
{
  "dependencies": {
    "resend": "^3.0.0",
    "@react-email/components": "^0.0.14",
    "openai": "^4.0.0",
    "@trpc/server": "^11.0.0",
    "ws": "^8.0.0"
  }
}
```

## Security Considerations

1. **Invitation Links**:
   - Use HTTPS only
   - Implement rate limiting
   - Log invitation usage
   - Validate token server-side

2. **Message Security**:
   - Sanitize user input
   - Validate participant membership
   - Implement message rate limiting

3. **AI Content**:
   - Filter inappropriate content
   - Log AI responses
   - Implement fallback for API failures

## Performance Targets

Based on specification requirements:
- Support 50+ participants per discussion
- Handle 100s of concurrent discussions
- Real-time message delivery < 500ms
- Page load < 2s

## Migration Notes

No database migration needed - all required models already exist in Prisma schema:
- Discussion model with all fields
- DiscussionParticipant for membership
- Message for conversation storage
- Invitation for access control

## Next Steps

Phase 1 will:
1. Generate API contracts for all tRPC endpoints
2. Create data model documentation
3. Write failing tests following TDD
4. Create quickstart guide for testing

## Conclusion

All technical unknowns have been resolved. The implementation will leverage:
- Existing tRPC/Prisma infrastructure
- Modern real-time messaging via WebSockets
- Secure invitation system with tokens
- AI facilitation through OpenAI
- Email invitations via Resend

The architecture maintains simplicity while meeting all functional requirements.