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
npm run dev           # Start Next.js dev server with Turbo

# Code Quality
npm run check         # Run Biome linter/formatter check
npm run check:write   # Auto-fix Biome issues
npm run typecheck     # TypeScript type checking (tsc --noEmit)

# Database
npm run db:push       # Push schema changes to database
npm run db:generate   # Generate Prisma migrations
npm run db:migrate    # Apply migrations to production
npm run db:studio     # Open Prisma Studio GUI

# Build & Production
npm run build         # Build for production
npm run start         # Start production server
npm run preview       # Build and start production locally
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

## Code Style

- Biome for formatting and linting with Tailwind class sorting enabled
- TypeScript strict mode with `noUncheckedIndexedAccess`
- ESM modules (`"type": "module"` in package.json)

## Recent Changes

### Lesson Management System (v0.2.0)
**Branch**: `001-we-want-to`
- Added Organization entity with tiered pricing (SMALL/MEDIUM/LARGE)
- Implemented lesson versioning system with LessonVersion model
- Added organization-based access control (OWNER/ADMIN/MEMBER roles)
- Created lesson CRUD with copy/fork functionality
- New tRPC routers: `organization` and `lesson`
- Updated sidebar navigation to include "Lessons" entry
- Multi-tenant architecture with data isolation per organization