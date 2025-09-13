# Tasks: Invitation Token Handler Page

**Input**: Design documents from `/specs/004-implement-invitation-token/`
**Prerequisites**: research.md, data-model.md, contracts/, quickstart.md

## Execution Flow (main)
```
1. Load design documents from feature directory
   → research.md: Extract tech stack (Next.js 15 App Router, tRPC)
   → data-model.md: Confirmed existing entities (no new models needed)
   → contracts/: 3 API contracts → 3 contract test tasks
   → quickstart.md: 7 test scenarios → integration test tasks
2. Generate tasks by category:
   → Setup: project structure, dependencies (none needed)
   → Tests: 3 contract tests, 7 integration scenarios
   → Core: 1 page component (main implementation)
   → Integration: No additional integration needed
   → Polish: E2E tests, performance validation
3. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
4. Number tasks sequentially (T001, T002...)
5. All contracts and scenarios tested before implementation
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Phase 3.1: Setup
- [ ] T001 Verify existing tRPC invitation and participant endpoints are functional

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**
- [ ] T002 [P] Contract test invitation.validate in tests/trpc/invitation-validate.test.ts
- [ ] T003 [P] Contract test invitation.getByToken in tests/trpc/invitation-get-by-token.test.ts  
- [ ] T004 [P] Contract test participant.join in tests/trpc/participant-join.test.ts
- [ ] T005 [P] Integration test valid invitation flow (anonymous) in tests/integration/invitation-token-valid-flow.test.ts
- [ ] T006 [P] Integration test expired invitation handling in tests/integration/invitation-token-expired.test.ts
- [ ] T007 [P] Integration test invalid token handling in tests/integration/invitation-token-invalid.test.ts
- [ ] T008 [P] Integration test full discussion handling in tests/integration/invitation-token-full-discussion.test.ts
- [ ] T009 [P] Integration test authenticated user flow in tests/integration/invitation-token-authenticated.test.ts
- [ ] T010 [P] Integration test network error handling in tests/integration/invitation-token-network-errors.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)
- [ ] T011 Create invitation token handler page at src/app/invitations/[token]/page.tsx

## Phase 3.4: Polish & Validation  
- [ ] T012 [P] E2E test mobile responsiveness in tests/e2e/invitation-mobile.spec.ts
- [ ] T013 [P] Performance test page load times (<2s) in tests/performance/invitation-page-load.test.ts
- [ ] T014 [P] E2E test complete invitation flow in tests/e2e/invitation-complete-flow.spec.ts
- [ ] T015 Run quickstart validation scenarios from quickstart.md
- [ ] T016 Verify TypeScript compilation and linting passes

## Dependencies
- Tests (T002-T010) before implementation (T011)
- T001 blocks T002-T004 (verify endpoints exist)
- Implementation (T011) before polish (T012-T016)
- T015 requires all previous tasks complete

## Parallel Example
```
# Launch T002-T004 together after T001:
Task: "Contract test invitation.validate in tests/trpc/invitation-validate.test.ts"
Task: "Contract test invitation.getByToken in tests/trpc/invitation-get-by-token.test.ts"  
Task: "Contract test participant.join in tests/trpc/participant-join.test.ts"

# Launch T005-T010 together after contracts:
Task: "Integration test valid invitation flow in tests/integration/invitation-token-valid-flow.test.ts"
Task: "Integration test expired invitation handling in tests/integration/invitation-token-expired.test.ts"
Task: "Integration test invalid token handling in tests/integration/invitation-token-invalid.test.ts"
Task: "Integration test full discussion handling in tests/integration/invitation-token-full-discussion.test.ts"
Task: "Integration test authenticated user flow in tests/integration/invitation-token-authenticated.test.ts"
Task: "Integration test network error handling in tests/integration/invitation-token-network-errors.test.ts"

# Launch T012-T014 together after T011:
Task: "E2E test mobile responsiveness in tests/e2e/invitation-mobile.spec.ts"
Task: "Performance test page load times in tests/performance/invitation-page-load.test.ts"
Task: "E2E test complete invitation flow in tests/e2e/invitation-complete-flow.spec.ts"
```

## Notes
- [P] tasks = different files, no dependencies
- Verify tests fail before implementing T011
- No new database models or API endpoints required
- Reuses existing tRPC invitation and participant routers
- Single page component implementation keeps tasks minimal
- Focus on comprehensive test coverage before implementation

## Task Details

### T001: Verify Existing Endpoints
**Purpose**: Confirm tRPC endpoints from contracts exist and are functional
**Files**: Check existing routers in src/server/api/routers/
**Success**: All three endpoints (validate, getByToken, join) respond correctly

### T002-T004: Contract Tests
**Purpose**: Test each API contract matches specification exactly
**Pattern**: Each contract file → one test file with comprehensive scenarios
**Success**: Tests fail initially, pass after implementation

### T005-T010: Integration Tests  
**Purpose**: Test complete user flows from quickstart scenarios
**Pattern**: Each quickstart scenario → one integration test
**Success**: Cover all error states and happy paths

### T011: Main Implementation
**Purpose**: Create the invitation token handler page component
**Files**: Single Next.js 15 App Router page at src/app/invitations/[token]/page.tsx
**Success**: Handles all contract requirements with proper error states

### T012-T014: E2E & Performance
**Purpose**: Validate real browser behavior and performance requirements
**Success**: Mobile responsive, <2s load time, complete user workflows work

### T015-T016: Final Validation
**Purpose**: Ensure implementation meets all requirements
**Success**: All quickstart scenarios pass, no TypeScript/lint errors

## Validation Checklist
*GATE: Checked before feature completion*

- [x] All 3 contracts have corresponding tests (T002-T004)
- [x] All 7 quickstart scenarios have integration tests (T005-T010)  
- [x] All tests come before implementation (T002-T010 → T011)
- [x] Parallel tasks truly independent ([P] tasks use different files)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] Single implementation file keeps execution simple