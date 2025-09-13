# Socratic Constitution

## Core Principles

### I. Education-First Design
Every feature must facilitate meaningful learning through Socratic dialogue. UI design prioritizes facilitator control and participant engagement over technical showcasing. Real-time interactions should feel natural and conversation-focused, not chat-room-like.

### II. Test-Driven Development (NON-NEGOTIABLE)
TDD mandatory: Write tests → Get user approval → Tests fail → Then implement. Red-Green-Refactor cycle strictly enforced. All features must have unit, integration, and E2E test coverage before shipping.

### III. Type-Safe API Contracts
All client-server communication must use tRPC with Zod validation. Breaking changes to API contracts require versioning and migration plans. Database schema changes must be validated with comprehensive tests.

### IV. Real-Time Reliability
Real-time features (messaging, participant presence) must handle network failures gracefully. Use progressive enhancement - core functionality works without WebSocket connections. Performance target: <2s response times, <500ms message delivery.

## Technical Constraints

### Stack Consistency
- Next.js App Router for all new pages/routes
- tRPC for all API operations (no direct database access from client)
- Prisma for all database operations with migration-based schema changes
- Biome for code quality (no exceptions for quick fixes)

### Data Integrity
- All user actions must be atomic (invitation acceptance, discussion joining)
- Soft deletes for discussions with active participants
- JWT tokens for stateless invitation validation with proper expiration handling

## Development Workflow

### Specification-Driven Development
Features start as business-focused specs in `/specs/` directory. No implementation until spec review checklist passes. Ambiguities must be marked and resolved before development begins.

### Quality Gates
- Biome check must pass before commit
- TypeScript strict mode with no `any` types
- All tests must pass in CI
- Performance regression tests for real-time features

## Governance

**Facilitator Experience Supersedes Developer Convenience**: When technical decisions conflict with educator usability, choose the path that supports better teaching outcomes.

**Privacy by Design**: Only store data essential for educational functionality.

**Version**: 1.0.0 | **Ratified**: 2025-09-09 | **Last Amended**: 2025-09-09