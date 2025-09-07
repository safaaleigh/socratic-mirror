# High-Level Architecture Overview

## System Architecture

The Socratic chat application follows a modern, type-safe architecture built on the T3 Stack, optimized for discussion-based learning experiences.

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Layer                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │   Next.js App Router (React 19 + TypeScript)        │    │
│  │   ├── Pages (Auth, Dashboard, Chat Rooms)           │    │
│  │   ├── UI Components (shadcn/ui + Radix UI)          │    │
│  │   └── Client-side State (React Query + Hook Form)   │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   tRPC API Layer   │
                    │  (Type-safe RPC)   │
                    └─────────┬─────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                         Server Layer                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │            Next.js API Routes + tRPC Routers        │    │
│  │   ├── Authentication (NextAuth.js)                  │    │
│  │   ├── Business Logic (Discussion Handlers)          │    │
│  │   └── Data Validation (Zod Schemas)                 │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │    Prisma ORM      │
                    │  (Data Abstraction) │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │    PostgreSQL      │
                    │     Database       │
                    └───────────────────┘
```

## Core Components

### Frontend Components
- **Next.js App Router**: Server-side rendering and routing with React Server Components
- **React Components**: Modular UI built with shadcn/ui component library
- **Theme System**: Dark/light mode support via next-themes
- **Form Management**: React Hook Form with Zod validation
- **State Management**: TanStack Query for server state caching and synchronization

### API Layer
- **tRPC**: End-to-end type-safe API calls without code generation
- **Procedures**: Public and protected endpoints with automatic type inference
- **SuperJSON**: Seamless serialization of complex data types (dates, maps, sets)

### Backend Services
- **Authentication Service**: NextAuth.js with credentials provider and JWT sessions
- **Authorization**: Protected procedures requiring valid sessions
- **Business Logic**: Discussion management, user interactions, learning analytics
- **Data Validation**: Zod schemas ensuring data integrity at runtime

### Data Layer
- **Prisma ORM**: Type-safe database client with migration management
- **PostgreSQL**: Relational database for persistent storage
- **Models**: User, Account, Session, and extensible for chat/discussion entities

## Data Flow Architecture

### Request Lifecycle
1. **User Interaction** → React component triggers action
2. **Client Validation** → React Hook Form + Zod validate input
3. **tRPC Call** → Type-safe RPC request via React Query
4. **Server Processing** → NextAuth validates session, tRPC router handles logic
5. **Database Operation** → Prisma executes type-safe query
6. **Response** → Data flows back through tRPC with automatic serialization
7. **UI Update** → React Query caches response, component re-renders

### Authentication Flow
```
User Login → Credentials Provider → bcrypt Validation 
    → JWT Generation → Session Storage → Protected Routes
```

### Real-time Discussion Flow (Future Enhancement)
```
Message Input → Validation → tRPC Mutation 
    → Database Write → WebSocket Broadcast* → UI Updates
```
*WebSocket integration would be added for real-time features

## Security Architecture

- **Authentication**: JWT-based sessions with secure httpOnly cookies
- **Password Security**: bcrypt hashing with salt rounds
- **Input Validation**: Zod schemas on both client and server
- **Type Safety**: End-to-end TypeScript preventing runtime errors
- **Environment Security**: Validated environment variables via zod
- **CSRF Protection**: Built into NextAuth.js
- **SQL Injection Prevention**: Parameterized queries via Prisma

## Development & Deployment Architecture

### Development Environment
- **Hot Reload**: Next.js Fast Refresh with Turbo
- **Type Checking**: TypeScript strict mode with `noUncheckedIndexedAccess`
- **Code Quality**: Biome for linting/formatting with Tailwind class sorting
- **Database Management**: Prisma Studio for visual database exploration

### Build Pipeline
```
Source Code → TypeScript Compilation → Next.js Build 
    → Static Optimization → Production Bundle
```

### Deployment Considerations
- **Edge-ready**: Next.js App Router optimized for edge runtimes
- **Database Migrations**: Prisma migrate for schema versioning
- **Environment Management**: Separate configs for dev/staging/production
- **Scalability**: Stateless architecture ready for horizontal scaling

## Extension Points for Chat Features

The current architecture provides solid foundations for implementing discussion-based learning features:

1. **Chat Rooms**: Extend Prisma schema with Room, Message, and Participant models
2. **Real-time Updates**: Add WebSocket server (Socket.io or native WebSockets)
3. **Learning Analytics**: Leverage existing PostgreSQL for tracking engagement metrics
4. **AI Integration**: tRPC procedures can easily integrate LLM APIs for Socratic guidance
5. **File Sharing**: Extend with cloud storage integration (S3, Cloudinary)
6. **Notifications**: Add email/push notification services via server-side procedures

This architecture ensures type safety from database to UI, maintainable code structure, and flexibility for evolving requirements while maintaining performance and security standards.

## Technology Stack Summary

### Core Stack (T3 Stack)
- **Next.js 15.2.3** - React framework with App Router
- **React 19** - UI library
- **TypeScript 5.8.2** - Type-safe JavaScript
- **tRPC v11** - End-to-end type-safe API layer
- **Prisma ORM 6.15** - Database ORM with PostgreSQL
- **NextAuth.js 5.0.0-beta** - Authentication (credentials provider)
- **Tailwind CSS v4** - Utility-first CSS framework

### Data & State Management
- **@tanstack/react-query v5** - Server state management
- **SuperJSON** - JSON serialization for tRPC
- **React Hook Form v7** - Form state management
- **Zod v3** - Schema validation

### UI Components & Styling
- **Radix UI** - Headless component primitives
- **shadcn/ui** - Component library built on Radix
- **Lucide React** - Icon library
- **CVA** - Class variance authority for component variants
- **clsx & tailwind-merge** - Utility class management
- **next-themes** - Dark/light mode support

### Development Tools
- **Biome 1.9.4** - Linting and formatting with Tailwind class sorting
- **PostCSS** - CSS processing
- **Turbo** - Build system optimization

### Database
- **PostgreSQL** - Primary database
- **Prisma Studio** - Database GUI
- **@auth/prisma-adapter** - NextAuth database adapter

### Authentication Features
- Credentials-based authentication with bcrypt password hashing
- JWT session strategy
- Custom sign-in/sign-out pages
- WebAuthn support (optional via Authenticator model)

### Project Structure
- App Router pattern in `/src/app/`
- tRPC routers in `/src/server/api/routers/`
- Shared UI components in `/src/components/`
- Environment validation with zod in `/src/env.js`
- ESM modules configuration