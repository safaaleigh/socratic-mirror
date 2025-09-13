# Tasks: Participant View for Discussion Engagement

**Input**: Design documents from `/specs/003-participant-view-should/`
**Prerequisites**: plan.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

## Execution Flow (main)
```
1. Load plan.md from feature directory ✓
   → Tech stack: Next.js 15, TypeScript, tRPC, Prisma, Vercel AI SDK
   → Structure: Web app (frontend + backend integration)
2. Load design documents ✓:
   → data-model.md: Participant, Message (extended), Discussion (extended) 
   → contracts/: participant-trpc-router.yaml, chat-streaming-api.yaml
   → research.md: AI SDK patterns, JWT security, lazy loading
   → quickstart.md: 8 test scenarios + performance validation
3. Generate tasks by category ✓
4. Apply TDD ordering ✓
5. Number tasks sequentially ✓
6. Generate dependency graph ✓
7. Create parallel execution examples ✓
8. Validate completeness ✓
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- File paths assume Next.js structure from existing codebase

## Phase 3.1: Setup & Dependencies
- [x] **T001** Install Vercel AI SDK dependencies: @ai-sdk/react, @ai-sdk/openai, jsonwebtoken, @types/jsonwebtoken
- [x] **T002** [P] Add JWT_SECRET environment variable to .env.example and env.js validation
- [x] **T003** [P] Create database migration for Participant model in prisma/migrations/

## Phase 3.2: Database Schema (Foundation)
- [x] **T004** Update Prisma schema in prisma/schema.prisma with Participant model and MessageSenderType enum
- [x] **T005** Extend Discussion model with invitationToken and maxParticipants fields in prisma/schema.prisma
- [x] **T006** Extend Message model with participantId, senderName, senderType fields in prisma/schema.prisma
- [x] **T007** Run migration and update Prisma client: bun run db:push

## Phase 3.3: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.4
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### tRPC Contract Tests
- [x] **T008** [P] Contract test participant.validateInvitation in tests/trpc/participant.validateInvitation.test.ts
- [x] **T009** [P] Contract test participant.join in tests/trpc/participant.join.test.ts  
- [x] **T010** [P] Contract test participant.leave in tests/trpc/participant.leave.test.ts
- [x] **T011** [P] Contract test participant.getMessageHistory in tests/trpc/participant.getMessageHistory.test.ts

### Streaming API Contract Tests
- [x] **T012** [P] Contract test POST /api/discussion/[id]/chat in tests/api/discussion-chat.test.ts
- [x] **T013** [P] Contract test GET /api/discussion/[id]/stream (SSE) in tests/api/discussion-stream.test.ts

### Integration Tests from Quickstart Scenarios
- [x] **T014** [P] Integration test: Valid invitation link access in tests/integration/invitation-access.test.ts
- [x] **T015** [P] Integration test: Participant join and message history in tests/integration/participant-join.test.ts
- [x] **T016** [P] Integration test: Real-time message sending in tests/integration/real-time-messaging.test.ts
- [x] **T017** [P] Integration test: Message history lazy loading in tests/integration/message-history.test.ts
- [x] **T018** [P] Integration test: Invalid invitation error handling in tests/integration/invitation-errors.test.ts

## Phase 3.4: Core Implementation (ONLY after tests are failing)

### JWT & Invitation Management  
- [x] **T019** [P] JWT invitation utilities in src/lib/invitation-jwt.ts
- [x] **T020** [P] Invitation validation service in src/services/invitation-service.ts

### tRPC Participant Router
- [x] **T021** Create participant tRPC router in src/server/api/routers/participant.ts
- [x] **T022** Add participant router to root tRPC router in src/server/api/root.ts
- [x] **T023** Implement validateInvitation procedure in participant router
- [x] **T024** Implement join procedure with session management in participant router
- [x] **T025** Implement leave procedure in participant router
- [x] **T026** Implement getMessageHistory with pagination in participant router

### AI SDK Streaming Endpoints
- [x] **T027** Create discussion chat API route in src/app/api/discussion/[id]/chat/route.ts
- [x] **T028** Create discussion stream API route in src/app/api/discussion/[id]/stream/route.ts  
- [x] **T029** Implement message broadcasting logic in chat route
- [x] **T030** Implement participant presence updates in stream route

### Database Integration
- [x] **T031** Message creation with participant support in src/services/message-service.ts
- [x] **T032** Participant session management in src/services/participant-service.ts
- [x] **T033** Discussion invitation token generation in src/services/discussion-service.ts

## Phase 3.5: Frontend Components

### Invitation & Join Flow
- [x] **T034** [P] Create join invitation page in src/app/join/[discussionId]/page.tsx
- [x] **T035** [P] Create participant name entry form component in src/app/join/[discussionId]/_components/name-entry-form.tsx
- [x] **T036** [P] Create invitation error page component in src/app/join/[discussionId]/_components/invitation-error.tsx

### Chat Interface
- [x] **T037** [P] Create participant discussion page in src/app/discussion/[id]/participant/page.tsx
- [x] **T038** [P] Create participant chat component with AI SDK in src/app/discussion/[id]/participant/_components/participant-chat.tsx
- [x] **T039** [P] Create message history lazy loading component in src/app/discussion/[id]/participant/_components/message-history.tsx
- [x] **T040** [P] Create participant list component in src/app/discussion/[id]/participant/_components/participant-list.tsx
- [x] **T041** [P] Create connection status indicator component in src/app/discussion/[id]/participant/_components/connection-status.tsx

### Chat Integration
- [x] **T042** Configure AI SDK useChat hook with custom transport in participant chat component
- [x] **T043** Implement real-time message rendering with participant/user distinction
- [x] **T044** Add participant leave functionality with confirmation dialog
- [x] **T045** Implement message history pagination and lazy loading

## Phase 3.6: End-to-End Tests
- [ ] **T046** [P] E2E test: Complete invitation flow (join → name entry → chat) in tests/e2e/invitation-flow.spec.ts
- [ ] **T047** [P] E2E test: Multi-participant real-time chat in tests/e2e/multi-participant-chat.spec.ts
- [ ] **T048** [P] E2E test: Message history and lazy loading in tests/e2e/message-history.spec.ts
- [ ] **T049** [P] E2E test: Error handling for invalid invitations in tests/e2e/invitation-errors.spec.ts

## Phase 3.7: Performance & Polish
- [ ] **T050** [P] Performance test: Load testing with 20+ concurrent participants in tests/performance/concurrent-participants.test.ts
- [ ] **T051** [P] Performance test: Message history lazy loading with 500+ messages in tests/performance/message-history-performance.test.ts
- [ ] **T052** [P] Unit tests for JWT invitation utilities in tests/unit/invitation-jwt.test.ts
- [ ] **T053** [P] Unit tests for participant service in tests/unit/participant-service.test.ts
- [ ] **T054** Optimize database queries with proper indexing (verify migration includes indexes)
- [ ] **T055** Add structured logging for participant events
- [ ] **T056** Execute quickstart validation scenarios from quickstart.md
- [ ] **T057** Update CLAUDE.md with participant patterns and usage examples

## Dependencies
```
Setup (T001-T007) → Tests (T008-T018) → Core (T019-T033) → Frontend (T034-T045) → E2E (T046-T049) → Polish (T050-T057)

Critical blocking relationships:
- T004-T007: Schema changes must complete before any DB-dependent tests/code
- T008-T018: All tests must be written and failing before T019+
- T021: Participant router creation blocks all tRPC procedures (T023-T026)
- T027-T028: API routes required for frontend integration (T042-T043)
- T034-T041: UI components needed for E2E tests (T046-T049)
```

## Parallel Execution Examples

### Phase 3.3: Launch all contract tests together
```bash
# Run these 11 test creation tasks in parallel:
Task: "Contract test participant.validateInvitation in tests/trpc/participant.validateInvitation.test.ts"
Task: "Contract test participant.join in tests/trpc/participant.join.test.ts"  
Task: "Contract test participant.leave in tests/trpc/participant.leave.test.ts"
Task: "Contract test participant.getMessageHistory in tests/trpc/participant.getMessageHistory.test.ts"
Task: "Contract test POST /api/discussion/[id]/chat in tests/api/discussion-chat.test.ts"
Task: "Contract test GET /api/discussion/[id]/stream in tests/api/discussion-stream.test.ts"
Task: "Integration test: Valid invitation link access in tests/integration/invitation-access.test.ts"
Task: "Integration test: Participant join and message history in tests/integration/participant-join.test.ts"  
Task: "Integration test: Real-time message sending in tests/integration/real-time-messaging.test.ts"
Task: "Integration test: Message history lazy loading in tests/integration/message-history.test.ts"
Task: "Integration test: Invalid invitation error handling in tests/integration/invitation-errors.test.ts"
```

### Phase 3.4: Launch utility services in parallel
```bash  
# Run these independent service tasks together:
Task: "JWT invitation utilities in src/lib/invitation-jwt.ts"
Task: "Invitation validation service in src/services/invitation-service.ts"
Task: "Message creation with participant support in src/services/message-service.ts"
Task: "Participant session management in src/services/participant-service.ts"
Task: "Discussion invitation token generation in src/services/discussion-service.ts"
```

### Phase 3.5: Launch UI components in parallel
```bash
# Run these independent component tasks together:
Task: "Create join invitation page in src/app/join/[discussionId]/page.tsx"
Task: "Create participant name entry form component in src/app/join/[discussionId]/_components/name-entry-form.tsx"
Task: "Create invitation error page component in src/app/join/[discussionId]/_components/invitation-error.tsx"
Task: "Create participant discussion page in src/app/discussion/[id]/participant/page.tsx"
Task: "Create participant chat component with AI SDK in src/app/discussion/[id]/participant/_components/participant-chat.tsx"
Task: "Create message history lazy loading component in src/app/discussion/[id]/participant/_components/message-history.tsx"
Task: "Create participant list component in src/app/discussion/[id]/participant/_components/participant-list.tsx"
Task: "Create connection status indicator component in src/app/discussion/[id]/participant/_components/connection-status.tsx"
```

## Validation Checklist ✓
*GATE: Checked before task execution*

- [✓] All contracts have corresponding tests (T008-T013 cover both contract files)
- [✓] All entities have model tasks (T004-T006 cover Participant, Discussion, Message)
- [✓] All tests come before implementation (Phase 3.3 before 3.4)
- [✓] Parallel tasks truly independent (different files, no shared dependencies)
- [✓] Each task specifies exact file path
- [✓] No task modifies same file as another [P] task
- [✓] All quickstart scenarios covered (T014-T018 + T046-T049)
- [✓] Performance requirements addressed (T050-T051)
- [✓] Integration with existing patterns maintained (follows lesson management structure)

## Notes
- **TDD Enforcement**: Tests T008-T018 MUST fail before implementing T019+
- **AI SDK Integration**: T042-T043 implement the Vercel AI SDK patterns from research.md  
- **JWT Security**: T019-T020 implement the security patterns from research.md
- **Performance**: T050-T051 validate <200ms latency and lazy loading requirements
- **Real-time**: T027-T030 implement the streaming architecture from contracts
- **Database**: Proper indexing included in migration (T003) per data-model.md performance notes