# Research: Invitation Token Handler Page

**Feature**: 004-implement-invitation-token  
**Date**: 2025-09-09

## Research Summary

This feature adds a `/invitations/[token]` page to handle invitation token links. All technical dependencies are already established in the existing codebase.

## Key Decisions

### 1. Page Architecture
**Decision**: Next.js 15 App Router page at `src/app/invitations/[token]/page.tsx`
**Rationale**: 
- Follows existing codebase App Router patterns
- Dynamic route `[token]` naturally handles token parameter
- Consistent with existing `/discussions/[id]` structure
**Alternatives considered**: 
- Pages Router: Rejected (codebase uses App Router)
- API route only: Rejected (need UI for user interaction)

### 2. Token Validation Strategy  
**Decision**: Use existing tRPC `invitation.validate` and `invitation.getByToken` endpoints
**Rationale**: 
- Reuses existing validation logic in invitation router
- Consistent error handling and token validation rules
- No duplication of business logic
**Alternatives considered**: 
- Client-side validation: Rejected (security and consistency concerns)
- New validation endpoints: Rejected (unnecessary duplication)

### 3. Anonymous Participation Flow
**Decision**: Use existing `participant.join` tRPC endpoint with name-only input
**Rationale**: 
- Leverages existing anonymous participant system
- Consistent with current participant join flow at `/join/[discussionId]`
- Reuses existing JWT token generation for participants
**Alternatives considered**: 
- New anonymous endpoint: Rejected (existing system handles this)
- Required authentication: Rejected (spec requires anonymous support)

### 4. Error Handling Strategy
**Decision**: Structured error states with user-friendly messages
**Rationale**: 
- Consistent with existing error handling patterns
- Clear feedback for expired/invalid/used tokens
- Graceful degradation for network issues
**Alternatives considered**: 
- Generic error messages: Rejected (poor UX)
- Redirect to error pages: Rejected (inline errors better UX)

### 5. UI/UX Approach
**Decision**: Card-based layout similar to existing join pages, mobile-responsive
**Rationale**: 
- Consistent with existing UI patterns in the codebase
- Tailwind CSS classes already established
- Mobile-first responsive design matches codebase standards
**Alternatives considered**: 
- Full-page layout: Rejected (doesn't match existing patterns)
- Modal approach: Rejected (not suitable for entry point)

### 6. State Management
**Decision**: React state with tRPC mutations, no additional state management
**Rationale**: 
- Simple page with limited state requirements
- tRPC provides optimistic updates and error handling
- Consistent with other form-based pages in codebase
**Alternatives considered**: 
- Zustand/Redux: Rejected (overkill for single page)
- URL state: Rejected (token in URL is sufficient)

## Integration Points

### Existing APIs to Use
- `invitation.validate` - Token validation
- `invitation.getByToken` - Fetch invitation details  
- `invitation.accept` - Accept invitation (for authenticated users)
- `participant.join` - Join as anonymous participant

### Existing Components to Reuse
- UI components from `/src/components/ui/` (Button, Card, Input, etc.)
- Layout patterns from existing join/discussion pages
- Error handling components and patterns

### Testing Strategy
- **Contract Tests**: Verify tRPC endpoint integration
- **Integration Tests**: Full invitation flow (valid/invalid tokens)
- **E2E Tests**: Browser-based user journey testing
- **Unit Tests**: Component logic and error states

## Implementation Dependencies

### Required Files
- `src/app/invitations/[token]/page.tsx` - Main page component
- Test files following existing patterns
- No new dependencies required

### Existing Infrastructure Used
- tRPC invitation and participant routers (already implemented)
- Prisma models (Invitation, Discussion, Participant)
- NextAuth session handling
- Tailwind CSS styling system

## Performance Considerations

- **Token Validation**: <500ms target (database lookup)
- **Page Load**: <2s initial render with invitation details
- **Error States**: Immediate feedback for invalid tokens
- **Mobile Performance**: Responsive design, touch-friendly buttons

## Security Considerations

- **Token Validation**: Server-side validation only
- **Rate Limiting**: Inherit from existing tRPC rate limiting
- **Anonymous Safety**: Name validation, no sensitive data exposure
- **Session Handling**: Optional authentication, graceful anonymous flow

---

**Status**: All unknowns resolved, ready for Phase 1 Design & Contracts