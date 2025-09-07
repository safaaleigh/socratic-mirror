# Implementation Plan: Discussions and Participant Experience

**Branch**: `002-discussions-and-participant` | **Date**: 2025-01-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-discussions-and-participant/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
4. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, or `GEMINI.md` for Gemini CLI).
6. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
7. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
8. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Enable educators to create AI-facilitated Socratic discussions from published lessons, with participant invitation mechanisms (email and shareable links) and cohort management. The system leverages existing lesson content to guide AI facilitation while providing real-time messaging, access control, and discussion lifecycle management.

## Technical Context
**Language/Version**: TypeScript 5.6 / Node.js 20+  
**Primary Dependencies**: Next.js 15, tRPC 11, Prisma ORM, React 19, NextAuth  
**Storage**: PostgreSQL (via Prisma ORM)  
**Testing**: Vitest (unit), Playwright (E2E)  
**Target Platform**: Web application (browser-based)
**Project Type**: web (frontend + backend monorepo using Next.js App Router)  
**Performance Goals**: <2s page load, real-time messaging updates, 100 concurrent discussions  
**Constraints**: Maintain existing auth flow (Discord provider), reuse lesson management system  
**Scale/Scope**: Support 50+ participants per discussion, 100s of concurrent discussions

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 1 (Next.js monorepo with src/app and src/server)
- Using framework directly? YES (tRPC, Prisma, Next.js App Router)
- Single data model? YES (Prisma models, no separate DTOs)
- Avoiding patterns? YES (direct tRPC procedures, no unnecessary abstractions)

**Architecture**:
- EVERY feature as library? NO - Using existing Next.js/tRPC patterns
- Libraries listed: N/A - Following established project structure
- CLI per library: N/A - Web application focus
- Library docs: Will document tRPC endpoints in contracts/

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? YES
- Git commits show tests before implementation? YES
- Order: Contract→Integration→E2E→Unit strictly followed? YES
- Real dependencies used? YES (PostgreSQL via Prisma)
- Integration tests for: new tRPC routers, API contracts, discussion flows? YES
- FORBIDDEN: Implementation before test, skipping RED phase - UNDERSTOOD

**Observability**:
- Structured logging included? YES (existing patterns)
- Frontend logs → backend? Via tRPC error handling
- Error context sufficient? YES (tRPC context + Prisma errors)

**Versioning**:
- Version number assigned? 0.3.0 (following from 0.2.0 lesson management)
- BUILD increments on every change? Via package.json
- Breaking changes handled? N/A (internal application)

## Project Structure

### Documentation (this feature)
```
specs/002-discussions-and-participant/
├── spec.md              # Feature specification
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Next.js App Router structure (existing)
src/
├── app/                      # Next.js pages and components
│   ├── discussions/          # Discussion UI pages (new)
│   │   ├── page.tsx         # Discussion list
│   │   ├── [id]/            # Individual discussion
│   │   └── _components/     # Discussion components
│   └── _components/         # Shared components
├── server/
│   ├── api/
│   │   ├── routers/
│   │   │   ├── discussion.ts   # Discussion tRPC router (new)
│   │   │   ├── invitation.ts   # Invitation tRPC router (new)
│   │   │   └── message.ts      # Message tRPC router (new)
│   │   └── root.ts             # Router composition
│   └── services/
│       ├── ai-facilitator.ts   # AI service (new)
│       └── email.ts            # Email service (new)
└── trpc/                    # tRPC client config

tests/
├── discussion/              # Discussion tests (new)
│   ├── discussion.test.ts  # Unit tests
│   └── discussion.e2e.ts   # E2E tests
└── integration/            # Integration tests
```

**Structure Decision**: Option 2 (Web application) - Using existing Next.js monorepo structure

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - Real-time messaging implementation in Next.js/tRPC
   - Email service integration options
   - AI integration approach for Socratic facilitation
   - Invitation link security patterns

2. **Key research areas**:
   - WebSocket vs Server-Sent Events vs polling for real-time updates
   - Email providers (SendGrid, Resend, AWS SES) for invitations
   - AI provider integration (OpenAI, Anthropic) for facilitation
   - Secure invitation token generation and validation

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all technical decisions documented

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `/scripts/update-agent-context.sh [claude|gemini|copilot]` for your AI assistant
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Each tRPC router → contract test tasks (discussion, invitation, message)
- Database models already exist - no model creation needed
- Each user story → integration test task
- Implementation tasks to make tests pass

**Task Categories**:
1. **Contract Tests** (TDD - must fail first):
   - Discussion API contract tests
   - Invitation API contract tests
   - Message API contract tests

2. **Integration Tests**:
   - Discussion creation flow
   - Invitation acceptance flow
   - Real-time messaging flow
   - AI facilitation flow

3. **Implementation Tasks**:
   - tRPC routers (discussion, invitation, message)
   - Email service integration (Resend)
   - AI service integration (OpenAI)
   - WebSocket setup for subscriptions
   - UI components for discussions

**Ordering Strategy**:
- TDD order: Tests before implementation 
- Dependency order: Services before routers before UI
- Mark [P] for parallel execution (independent files)

**Estimated Output**: 30-35 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |


## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none required)

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*