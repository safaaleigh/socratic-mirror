# Implementation Plan: Participant View for Discussion Engagement

**Branch**: `003-participant-view-should` | **Date**: 2025-09-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-participant-view-should/spec.md`

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
Enable invitees to join existing discussions via invitation links, enter their name, and participate in real-time Socratic dialogue. Uses Vercel AI SDK's useChat hook for real-time messaging with lazy-loaded message history and participant management.

## Technical Context
**Language/Version**: TypeScript/Next.js 15 with App Router  
**Primary Dependencies**: Vercel AI SDK (@ai-sdk/react, @ai-sdk/openai), tRPC, Prisma ORM, NextAuth.js  
**Storage**: PostgreSQL with Prisma ORM for discussions, messages, participants  
**Testing**: Vitest (unit), Playwright (E2E), existing test patterns from lesson management  
**Target Platform**: Web browser (responsive design for desktop/mobile)  
**Project Type**: web - frontend + backend integration  
**Performance Goals**: Real-time messaging <200ms latency, lazy loading for message history >50 messages  
**Constraints**: No authentication required for participants, invitation links expire when discussion ends  
**Scale/Scope**: Multiple concurrent discussions, 10-50 participants per discussion, message history preserved

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 1 (integrated Next.js app with tRPC - existing architecture)
- Using framework directly? Yes (Vercel AI SDK useChat hook, tRPC, Prisma)
- Single data model? Yes (Discussion, Message, Participant entities)
- Avoiding patterns? Yes (leveraging existing T3 stack patterns)

**Architecture**:
- EVERY feature as library? Using existing tRPC router pattern (participant router)
- Libraries listed: participant-chat (real-time messaging), invitation-manager (link validation)
- CLI per library: N/A (web feature, using existing bun commands)
- Library docs: Integrated with existing CLAUDE.md

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? YES - contract tests first
- Git commits show tests before implementation? YES - following lesson mgmt pattern
- Order: Contract→Integration→E2E→Unit strictly followed? YES
- Real dependencies used? YES (PostgreSQL via Prisma)
- Integration tests for: new tRPC routers, WebSocket connections, message persistence
- FORBIDDEN: Implementation before test, skipping RED phase

**Observability**:
- Structured logging included? YES (following existing patterns)
- Frontend logs → backend? YES (tRPC error handling)
- Error context sufficient? YES (invitation validation, connection failures)

**Versioning**:
- Version number assigned? v0.3.0 (participant experience feature)
- BUILD increments on every change? Following existing semver
- Breaking changes handled? New feature - no breaking changes to existing

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

**Structure Decision**: Option 2 (Web application) - Frontend components + backend tRPC routers required

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
- Generate from Phase 1 artifacts (data-model.md, participant-trpc-router.yaml, chat-streaming-api.yaml, quickstart.md)
- Database migration tasks from data-model.md schema changes [P]
- Contract test tasks from tRPC router specification [P] 
- Contract test tasks from streaming API specification [P]
- Component tasks for participant UI (name entry, chat interface) [P]
- Integration test tasks from quickstart scenarios
- Implementation tasks following TDD red-green-refactor

**Ordering Strategy**:
- Phase A: Database schema + migrations (foundation)
- Phase B: Contract tests for tRPC + streaming APIs (parallel)
- Phase C: Models and core business logic to make contract tests pass
- Phase D: UI components and integration (depends on APIs)
- Phase E: End-to-end test implementation from quickstart scenarios
- Mark [P] for tasks that can run in parallel within each phase

**Estimated Output**: 35-40 numbered, ordered tasks covering:
- 3 database migration tasks
- 8 contract test tasks (4 tRPC + 4 streaming)
- 6 model/business logic tasks 
- 12 UI component tasks
- 8 integration test tasks
- 5 quickstart validation tasks

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