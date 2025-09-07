# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a T3 Stack application using:
- Next.js 15 with App Router
- TypeScript with strict mode
- tRPC for type-safe API routes
- Prisma ORM with PostgreSQL
- NextAuth.js for authentication (Discord provider)
- Tailwind CSS v4
- React Query for data fetching
- Biome for linting/formatting

## Commands

```bash
# Development
bun run dev           # Start Next.js dev server with Turbo
bun run dev --port 3001  # Start on custom port

# Code Quality
bun run check         # Run Biome linter/formatter check
bun run check:write   # Auto-fix Biome issues
bun run typecheck     # TypeScript type checking (tsc --noEmit)

# Testing
bun test              # Run unit tests (Vitest)
bun test tests/lesson/  # Run specific test suite
bunx playwright test  # Run E2E tests (Playwright)
bun test tests/performance/  # Run performance tests

# Database
bun run db:push       # Push schema changes to database
bun run db:generate   # Generate Prisma migrations
bun run db:migrate    # Apply migrations to production
bun run db:studio     # Open Prisma Studio GUI

# Build & Production
bun run build         # Build for production
bun run start         # Start production server
bun run preview       # Build and start production locally

# Dependencies
bun install           # Install dependencies
bun add <package>     # Add dependency
bun add -d <package>  # Add dev dependency
```

## Architecture

### File Structure
- `/src/app/` - Next.js App Router pages and components
- `/src/server/` - Backend logic:
  - `api/routers/` - tRPC router definitions
  - `api/trpc.ts` - tRPC context and procedure definitions
  - `auth/` - NextAuth configuration
  - `db.ts` - Prisma client instance
- `/src/trpc/` - tRPC client configuration
- `/prisma/schema.prisma` - Database schema

### Key Patterns

**tRPC Setup**: The app uses tRPC for type-safe API calls. Routers are defined in `/src/server/api/routers/` and composed in `/src/server/api/root.ts`. Two procedure types exist:
- `publicProcedure` - Accessible to all users
- `protectedProcedure` - Requires authentication

**Authentication**: NextAuth.js with Discord provider. Sessions are available in tRPC context via `ctx.session`.

**Database Access**: Use the Prisma client instance from `@/server/db`. The schema includes User, Account, Session, Discussion, Group, Lesson, and VerificationToken models.

**Environment Variables**: Validated using zod in `/src/env.js`. Required vars:
- `DATABASE_URL` - PostgreSQL connection string
- `AUTH_DISCORD_ID` & `AUTH_DISCORD_SECRET` - Discord OAuth credentials  
- `AUTH_SECRET` - NextAuth secret (required in production)

**Path Aliases**: Use `@/*` to import from `/src/*`

## Features

### Lesson Management System

**Core Feature**: Complete CRUD lesson management with lifecycle support, integrated UI, and comprehensive testing.

#### API Overview
The lesson management system is built around the `lesson` tRPC router (`/src/server/api/routers/lesson.ts`) with these endpoints:

- `lesson.create` - Create new lesson (draft status)
- `lesson.list` - Get user's lessons with computed status
- `lesson.getById` - Fetch specific lesson with ownership validation
- `lesson.update` - Update lesson content (draft/published only)
- `lesson.publish` - Publish lesson (draft → published)
- `lesson.archive` - Archive lesson (published → archived)
- `lesson.delete` - Delete lesson with discussion handling
- `lesson.fork` - Create copy from archived lesson

#### Data Model
Lessons use the existing Prisma `Lesson` model with computed status:
```typescript
type LessonStatus = "draft" | "published" | "archived"
// Computed from isPublished and isArchived boolean fields
```

#### UI Components
Lesson management UI at `/lessons` with:
- **Lesson List** (`/src/app/lessons/_components/lesson-list.tsx`) - Displays lessons with status indicators
- **Create Form** (`/src/app/lessons/_components/create-lesson-form.tsx`) - New lesson creation
- **Edit Form** (`/src/app/lessons/_components/edit-lesson-form.tsx`) - Lesson modification
- **Navigation Integration** - Added to sidebar navigation

#### Lifecycle States
```
Draft → Published → Archived
  ↓         ↓         ↓
Edit      Archive   Fork
Delete    Delete    Delete
```

#### Testing Coverage
- **Unit Tests**: 42 tests covering all CRUD operations, lifecycle transitions, validation, and error cases
- **E2E Tests**: 21 Playwright tests covering complete user workflows across browsers
- **Performance Tests**: 11 tests validating <2s response times (avg 313ms)

#### Usage Examples
```typescript
// Create lesson
const lesson = await trpc.lesson.create.mutate({
  title: "Critical Thinking Basics",
  description: "Introduction to analytical reasoning",
  content: "Learn to evaluate arguments...",
  objectives: ["Identify logical fallacies"],
  keyQuestions: ["What makes an argument valid?"],
  facilitationStyle: "analytical",
  suggestedDuration: 45,
  suggestedGroupSize: 4
});

// Publish lesson
await trpc.lesson.publish.mutate({ id: lesson.id });

// List user's lessons
const lessons = await trpc.lesson.list.query();
```

## Code Style

- Biome for formatting and linting with Tailwind class sorting enabled
- TypeScript strict mode with `noUncheckedIndexedAccess`
- ESM modules (`"type": "module"` in package.json)

## Recent Changes

### Core Lesson Management System (v0.2.0) ✅ COMPLETED
**Branch**: `001-core-lesson-management`
- ✅ Implemented complete CRUD operations for lesson management
- ✅ Full tRPC lesson router with lifecycle support (draft → published → archived → fork)
- ✅ Lesson management UI at `/lessons` with list view and status indicators
- ✅ Updated sidebar navigation with "Lessons" entry (removed mock entries)
- ✅ Type-safe API contracts with comprehensive Zod validation
- ✅ Integrated with existing Prisma Lesson model (no schema changes needed)
- ✅ Business logic for state transitions and ownership validation
- ✅ Error handling, logging, and user permission enforcement

### Previous: Lesson Management System (v0.1.0) 
**Branch**: `001-we-want-to`
- Added Organization entity with tiered pricing (SMALL/MEDIUM/LARGE)
- Implemented lesson versioning system with LessonVersion model
- Added organization-based access control (OWNER/ADMIN/MEMBER roles)