# Research: Participant View Implementation

## Vercel AI SDK Integration for Real-time Chat

### Decision: Use useChat hook with custom transport
**Rationale**: 
- Provides built-in state management for messages, input, status
- Handles real-time streaming automatically
- Supports custom request configuration for participant context
- Integrates seamlessly with existing Next.js App Router

**Implementation Pattern**:
```typescript
const { messages, sendMessage, status } = useChat({
  transport: new DefaultChatTransport({
    api: '/api/discussion/[id]/chat',
    body: () => ({
      participantName: currentParticipant.name,
      discussionId: discussionId,
    }),
  }),
  initialMessages: discussionHistory, // Lazy-loaded
});
```

**Alternatives considered**:
- Custom WebSocket implementation: More complex, reinventing wheel
- Server-sent events: Less real-time, more manual state management

## tRPC Real-time Patterns

### Decision: Hybrid approach - tRPC for data, WebSocket for real-time
**Rationale**:
- tRPC excellent for CRUD operations (join discussion, validate invitation)
- WebSocket needed for real-time message broadcasting
- Vercel AI SDK handles WebSocket internally via streaming

**Pattern**:
- `/api/trpc/discussion.*` - CRUD operations
- `/api/discussion/[id]/chat` - AI SDK streaming endpoint
- Background: Use Pusher/WebSocket for participant presence

**Alternatives considered**:
- tRPC subscriptions: Complex setup, overkill for message streaming
- Pure REST: Loses type safety benefits

## Invitation Link Security

### Decision: JWT-based invitation tokens with discussion-scoped validation
**Rationale**:
- Stateless validation (no DB lookup per link click)
- Can embed discussion ID and expiration
- Follows security best practices for temporary access

**Implementation**:
```typescript
// Generate invitation
const token = jwt.sign(
  { discussionId, expiresAt: discussion.endTime },
  process.env.INVITATION_SECRET,
);
const invitationLink = `/join/${discussionId}?token=${token}`;

// Validate on access
const { discussionId, expiresAt } = jwt.verify(token, process.env.INVITATION_SECRET);
```

**Alternatives considered**:
- UUID in database: Requires DB lookup, cleanup overhead
- Simple discussion ID: No security, anyone can join any discussion

## Message History Lazy Loading

### Decision: Pagination with cursor-based loading
**Rationale**:
- Efficient for large message histories
- Stable pagination (no missed messages during loading)
- AI SDK supports initialMessages for context

**Pattern**:
```typescript
// Initial load: Last 20 messages
const initialMessages = await getMessages(discussionId, { last: 20 });

// Lazy load: Earlier messages on scroll
const earlierMessages = await getMessages(discussionId, { 
  before: oldestMessageId, 
  limit: 20 
});
```

**Alternatives considered**:
- Offset pagination: Unstable with new messages
- Load all messages: Poor performance for long discussions

## Participant State Management

### Decision: Session-based participant tracking with voluntary cleanup
**Rationale**:
- No authentication required (per spec)
- Participants can leave voluntarily
- Session cleanup on browser close/navigation

**Implementation**:
- Client-side: React state for current participant
- Server-side: In-memory participant registry per discussion
- Cleanup: WebSocket disconnect handlers + periodic cleanup

**Alternatives considered**:
- Database participant records: Overkill for temporary participation
- Browser localStorage only: No server-side presence tracking

## WebSocket/Real-time Architecture

### Decision: Integrate with Vercel AI SDK streaming + separate presence channel
**Rationale**:
- AI SDK handles message streaming automatically
- Separate lightweight channel for participant presence
- Leverages existing infrastructure

**Pattern**:
- Message flow: useChat → AI SDK → streaming response
- Presence flow: WebSocket → broadcast participant join/leave
- Message persistence: tRPC mutation on successful send

**Alternatives considered**:
- Single WebSocket for everything: Conflicts with AI SDK patterns
- No real-time presence: Poor UX for participant awareness

## Error Handling Patterns

### Decision: Graceful degradation with retry mechanisms
**Rationale**:
- Network issues common in real-time scenarios
- Users should not lose message drafts
- Clear error messaging builds trust

**Patterns**:
- Connection loss: Show offline banner, queue messages
- Invalid invitation: Redirect to error page with explanation
- Message send failure: Retry with backoff, show status

## Performance Considerations

### Decision: Optimize for perceived performance over absolute metrics
**Rationale**:
- Real-time chat is interactive, responsiveness critical
- User perception more important than raw throughput
- Progressive enhancement for slow connections

**Optimizations**:
- Optimistic UI updates (show message immediately)
- Message batching for rapid typing
- Lazy load images/attachments in messages
- Skeleton loading states

## Integration with Existing Architecture

### Decision: Extend existing patterns without breaking changes
**Rationale**:
- Leverage proven lesson management architecture
- Maintain consistency in codebase
- Reuse existing testing and deployment patterns

**Extensions**:
- New tRPC router: `discussion` (following `lesson` pattern)
- New page structure: `/discussion/[id]/participant` route
- Database: Extend existing Discussion model with participant fields
- Testing: Follow existing Vitest + Playwright patterns