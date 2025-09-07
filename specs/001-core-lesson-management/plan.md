# Implementation Plan: Core Lesson Management

**Branch**: `001-core-lesson-management` | **Date**: 2025-01-07 | **Spec**: [/specs/001-core-lesson-management/spec.md](/specs/001-core-lesson-management/spec.md)
**Input**: Feature specification from `/specs/001-core-lesson-management/spec.md`

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
Primary requirement: Implement CRUD operations for lessons that educators can create, organize, and manage to guide AI-facilitated Socratic discussions. Technical approach: Extend existing T3 Stack application with tRPC lesson router, Prisma model updates, and Next.js UI components for lesson management with status lifecycle (draft → published → archived).

## Technical Context
**Language/Version**: TypeScript 5.8.2, Node.js (Next.js 15)
**Primary Dependencies**: Next.js 15 (App Router), tRPC 11, Prisma 6.15, NextAuth.js 5.0, Tailwind CSS v4, React 19
**Storage**: PostgreSQL with Prisma ORM
**Testing**: Built-in Next.js testing (to be configured), TypeScript type checking
**Target Platform**: Web application (desktop/mobile browser)
**Project Type**: web (frontend + backend in Next.js full-stack)
**Performance Goals**: <2s page loads, real-time lesson management via tRPC
**Constraints**: Multi-user concurrent editing, lesson versioning for active discussions
**Scale/Scope**: Multi-tenant lesson management system with CRUD operations

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 1 (web app with integrated frontend/backend via Next.js)
- Using framework directly? YES (tRPC, Prisma, Next.js used directly)
- Single data model? YES (Prisma schema serves both API and UI)
- Avoiding patterns? YES (no Repository/UoW - using Prisma client directly)

**Architecture**:
- EVERY feature as library? NO - extending existing T3 Stack app
- Libraries listed: N/A (feature extension, not new library)
- CLI per library: N/A (web-based CRUD operations)
- Library docs: N/A (web application feature)

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? PLANNED (will write failing tests first)
- Git commits show tests before implementation? PLANNED
- Order: Contract→Integration→E2E→Unit strictly followed? YES (API contracts → integration → unit)
- Real dependencies used? YES (actual PostgreSQL database)
- Integration tests for: YES (new tRPC routes, schema changes)
- FORBIDDEN: Implementation before test, skipping RED phase

**Observability**:
- Structured logging included? EXISTING (Next.js built-in logging)
- Frontend logs → backend? EXISTING (tRPC error handling)
- Error context sufficient? YES (tRPC + Zod validation provides context)

**Versioning**:
- Version number assigned? YES (0.2.0 - lesson management system)
- BUILD increments on every change? YES (package.json version)
- Breaking changes handled? YES (Prisma migrations, API versioning)

## Project Structure

### Documentation (this feature)
```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure]
```

**Structure Decision**: Option 2 (Web application) - Using existing Next.js full-stack structure with /src/app/, /src/server/, /src/trpc/

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

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
- Generate tasks from Phase 1 design docs:
  - API contracts from `contracts/lesson-api.ts` → contract test tasks [P]
  - Lesson entity operations from `data-model.md` → tRPC router implementation [P]
  - User scenarios from `quickstart.md` → integration test tasks
  - UI requirements from feature spec → Next.js component tasks
- Constitutional requirement: Tests before implementation (RED-GREEN-Refactor)

**Ordering Strategy**:
- **Phase A**: Contract Tests (failing tests first)
  - tRPC lesson router contract tests [P]
  - API input/output validation tests [P]
  - Error handling tests [P]
- **Phase B**: Backend Implementation  
  - Implement tRPC lesson router procedures
  - Add lesson business logic for state transitions
  - Error handling and authorization
- **Phase C**: Frontend Implementation
  - Sidebar navigation integration
  - Lesson CRUD UI components
  - Form validation and state management
- **Phase D**: Integration Testing
  - End-to-end lesson management workflows
  - User permission and ownership validation
  - Performance and concurrent user testing

**Parallel Execution Groups**:
- [P] Contract tests can run in parallel (independent API endpoints)
- [P] UI components can be developed in parallel with backend
- [P] Integration tests can be written in parallel with implementation

**Estimated Output**: 20-25 numbered, ordered tasks in tasks.md

**Key Dependencies**:
- Existing Prisma schema (no changes needed)
- Existing tRPC setup and patterns
- Existing Next.js UI component patterns

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
- [x] Complexity deviations documented (N/A - no violations)

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*