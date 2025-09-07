# Tasks: Discussions and Participant Experience

**Input**: Design documents from `/specs/002-discussions-and-participant/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → Tech stack: TypeScript, Next.js 15, tRPC 11, Prisma, React 19
   → Structure: Next.js monorepo (src/app, src/server)
2. Load optional design documents:
   → data-model.md: Models already exist in Prisma schema
   → contracts/: discussion-api.ts, invitation-api.ts, message-api.ts
   → research.md: Resend email, OpenAI AI, WebSocket real-time
3. Generate tasks by category:
   → Setup: dependencies, environment variables
   → Tests: contract tests, integration tests, E2E tests
   → Core: services, tRPC routers, UI components
   → Integration: WebSocket, email, AI services
   → Polish: error handling, performance, documentation
4. Apply TDD rules:
   → Tests before implementation
   → Contract tests must fail first
5. Number tasks sequentially (T001-T035)
6. Generate dependency graph
7. Create parallel execution examples
8. Return: SUCCESS (35 tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Next.js monorepo**: `src/app/`, `src/server/`, `tests/`
- All paths relative to repository root

## Phase 3.1: Setup
- [x] T001 Install dependencies: resend, @react-email/components, openai, ws
- [x] T002 Add environment variables to .env.local: RESEND_API_KEY, OPENAI_API_KEY, WS_PORT
- [x] T003 [P] Create discussion UI directory structure at src/app/discussions/
- [x] T004 [P] Create service directories at src/server/services/

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

### Contract Tests (Must Fail Initially)
- [x] T005 [P] Create discussion router contract tests at tests/discussion/discussion.test.ts
- [x] T006 [P] Create invitation router contract tests at tests/invitation/invitation.test.ts  
- [x] T007 [P] Create message router contract tests at tests/message/message.test.ts
- [x] T008 Run tests and verify all fail with "router not implemented"

### Integration Tests (Must Fail Initially)
- [x] T009 [P] Create discussion creation flow test at tests/integration/create-discussion.test.ts
- [x] T010 [P] Create invitation acceptance flow test at tests/integration/accept-invitation.test.ts
- [x] T011 [P] Create real-time messaging flow test at tests/integration/messaging.test.ts
- [x] T012 [P] Create AI facilitation flow test at tests/integration/ai-facilitation.test.ts
- [x] T013 Run integration tests and verify all fail

### E2E Tests (Must Fail Initially)
- [x] T014 Create E2E test for complete discussion lifecycle at tests/e2e/discussion.e2e.ts
- [x] T015 Run E2E test and verify it fails

## Phase 3.3: Core Implementation

### Services Layer
- [x] T016 [P] Implement email service at src/server/services/email.ts using Resend
- [x] T017 [P] Implement AI facilitator service at src/server/services/ai-facilitator.ts using OpenAI
- [x] T018 Implement WebSocket service at src/server/services/websocket.ts for real-time updates

### tRPC Routers
- [x] T019 Implement discussion router at src/server/api/routers/discussion.ts with all endpoints
- [x] T020 Implement invitation router at src/server/api/routers/invitation.ts with all endpoints
- [x] T021 Implement message router at src/server/api/routers/message.ts with all endpoints
- [x] T022 Update root router at src/server/api/root.ts to include new routers
- [x] T023 Run contract tests - they should now pass

### UI Components
- [x] T024 [P] Create discussion list component at src/app/discussions/_components/discussion-list.tsx
- [x] T025 [P] Create create discussion form at src/app/discussions/_components/create-discussion-form.tsx
- [x] T026 [P] Create invitation modal at src/app/discussions/_components/invite-participants-modal.tsx
- [x] T027 Create discussion page at src/app/discussions/page.tsx
- [x] T028 Create individual discussion view at src/app/discussions/[id]/page.tsx
- [x] T029 [P] Create message list component at src/app/discussions/[id]/_components/message-list.tsx
- [x] T030 [P] Create message input component at src/app/discussions/[id]/_components/message-input.tsx
- [x] T031 Update navigation at src/components/app-sidebar.tsx to include Discussions link (already included)

## Phase 3.4: Integration & Polish
- [ ] T032 Integrate WebSocket subscriptions in message components for real-time updates
- [x] T033 Add error handling and loading states to all UI components
- [ ] T034 Run all integration tests - they should now pass
- [ ] T035 Run E2E tests - they should now pass

## Parallel Execution Examples

### Batch 1: Setup (T003-T004)
```bash
# Can run simultaneously
Task agent: "Create discussion UI directory structure at src/app/discussions/"
Task agent: "Create service directories at src/server/services/"
```

### Batch 2: Contract Tests (T005-T007)
```bash
# Can run simultaneously - different test files
Task agent: "Create discussion router contract tests"
Task agent: "Create invitation router contract tests"
Task agent: "Create message router contract tests"
```

### Batch 3: Integration Tests (T009-T012)
```bash
# Can run simultaneously - independent test files
Task agent: "Create discussion creation flow test"
Task agent: "Create invitation acceptance flow test"
Task agent: "Create real-time messaging flow test"
Task agent: "Create AI facilitation flow test"
```

### Batch 4: Services (T016-T017)
```bash
# Can run simultaneously - independent services
Task agent: "Implement email service using Resend"
Task agent: "Implement AI facilitator service using OpenAI"
```

### Batch 5: UI Components (T024-T026, T029-T030)
```bash
# Can run simultaneously - independent components
Task agent: "Create discussion list component"
Task agent: "Create create discussion form"
Task agent: "Create invitation modal"
Task agent: "Create message list component"
Task agent: "Create message input component"
```

## Dependencies Graph
```
Setup (T001-T004)
    ↓
Contract Tests (T005-T008) ← Must fail first
    ↓
Integration Tests (T009-T013) ← Must fail first
    ↓
E2E Tests (T014-T015) ← Must fail first
    ↓
Services (T016-T018)
    ↓
tRPC Routers (T019-T023) ← Contract tests pass here
    ↓
UI Components (T024-T031)
    ↓
Integration (T032-T033)
    ↓
Final Tests (T034-T035) ← All tests pass here
```

## Success Criteria
- All 35 tasks completed
- All tests passing (contract, integration, E2E)
- Real-time messaging working
- AI facilitation responding appropriately
- Email invitations sending successfully
- UI responsive and functional

## Notes
- Database models already exist - no migration needed
- Use existing auth flow (Discord provider)
- Maintain existing patterns from lesson management system
- Follow TDD strictly - tests must fail before implementation