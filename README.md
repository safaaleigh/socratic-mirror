# Socratic

A modern full-stack application built with the T3 Stack, featuring type-safe APIs, authentication, and a responsive UI.

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript with strict mode
- **API**: tRPC for type-safe API routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with Discord provider
- **Styling**: Tailwind CSS v4 with shadcn/ui components
- **Data Fetching**: React Query
- **Code Quality**: Biome for linting/formatting

## Prerequisites

- Node.js 18+ or Bun
- PostgreSQL 16+
- Discord Application (for OAuth)

## Setup Instructions

### 1. Install Dependencies

```bash
# Using npm
npm install

# Using bun (recommended)
bun install
```

### 2. Database Setup

#### Install PostgreSQL 16 with Homebrew (macOS)

```bash
# Install PostgreSQL 16
brew install postgresql@16

# Start PostgreSQL service
brew services start postgresql@16

# Add PostgreSQL to your PATH (add to your shell profile)
echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

#### Create Database and User

```bash
# Connect to PostgreSQL as the default user
psql postgres

# Create a new user with password
CREATE USER socratic_user WITH PASSWORD 'your_secure_password';

# Create the database
CREATE DATABASE socratic;

# Grant privileges to the user
GRANT ALL PRIVILEGES ON DATABASE socratic TO socratic_user;

# Grant schema privileges
GRANT ALL ON SCHEMA public TO socratic_user;

# Exit PostgreSQL
\q
```

#### Alternative: Quick Setup Script

```bash
# Create database and user in one command
psql postgres -c "CREATE USER socratic_user WITH PASSWORD 'your_secure_password';"
psql postgres -c "CREATE DATABASE socratic;"
psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE socratic TO socratic_user;"
psql postgres -c "GRANT ALL ON SCHEMA public TO socratic_user;"
```

### 3. Environment Configuration

Copy the example environment file and configure your variables:

```bash
cp .env.example .env
```

Update `.env` with your configuration:

```env
# Database
DATABASE_URL="postgresql://socratic_user:your_secure_password@localhost:5432/socratic?schema=public"

# NextAuth
AUTH_SECRET="your-auth-secret-here" # Generate with: openssl rand -base64 32
AUTH_URL="http://localhost:3000"

# Discord OAuth (create app at https://discord.com/developers/applications)
AUTH_DISCORD_ID="your-discord-client-id"
AUTH_DISCORD_SECRET="your-discord-client-secret"
```

### 4. Database Migration

```bash
# Generate Prisma client and push schema to database
npm run db:push

# Optional: Generate migration files for production
npm run db:generate
```

### 5. Discord OAuth Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to OAuth2 → General
4. Add redirect URI: `http://localhost:3000/api/auth/callback/discord`
5. Copy the Client ID and Client Secret to your `.env` file

### 6. Start Development Server

```bash
# Start the development server
npm run dev

# Or with bun
bun run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000)

## Available Scripts

### Development
```bash
npm run dev           # Start Next.js dev server with Turbo
```

### Code Quality
```bash
npm run check         # Run Biome linter/formatter check
npm run check:write   # Auto-fix Biome issues
npm run typecheck     # TypeScript type checking
```

### Database
```bash
npm run db:push       # Push schema changes to database
npm run db:generate   # Generate Prisma migrations
npm run db:migrate    # Apply migrations to production
npm run db:studio     # Open Prisma Studio GUI
```

### Build & Production
```bash
npm run build         # Build for production
npm run start         # Start production server
npm run preview       # Build and start production locally
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── dashboard/         # Dashboard pages
│   ├── auth/             # Authentication pages
│   └── api/              # API routes
├── components/           # React components
│   └── ui/              # shadcn/ui components
├── hooks/               # Custom React hooks
├── server/              # Backend logic
│   ├── api/             # tRPC routers
│   ├── auth/            # NextAuth configuration
│   └── db.ts            # Prisma client
└── trpc/                # tRPC client configuration
```

## Key Features

- **Type-Safe APIs**: Full-stack type safety with tRPC
- **Authentication**: Secure OAuth with NextAuth.js
- **Modern UI**: Responsive design with Tailwind CSS and shadcn/ui
- **Database**: PostgreSQL with Prisma ORM for type-safe queries
- **Code Quality**: Biome for consistent code formatting and linting

## Database Management

### Viewing Data
```bash
# Open Prisma Studio to view/edit data
npm run db:studio
```

### Schema Changes
```bash
# After modifying prisma/schema.prisma
npm run db:push        # For development
npm run db:generate    # Generate migration files
npm run db:migrate     # Apply migrations (production)
```

### Reset Database
```bash
# Reset database and apply migrations
npx prisma migrate reset
```

## Troubleshooting

### Common Issues

1. **PostgreSQL Connection Error**
   - Ensure PostgreSQL service is running: `brew services start postgresql@16`
   - Check your DATABASE_URL in `.env`
   - Verify user permissions: `psql -U socratic_user -d socratic`

2. **Discord OAuth Error**
   - Verify redirect URI in Discord app settings
   - Check AUTH_DISCORD_ID and AUTH_DISCORD_SECRET in `.env`
   - Ensure AUTH_URL matches your domain

3. **TypeScript Errors**
   - Run `npm run typecheck` to identify issues
   - Ensure Prisma client is generated: `npx prisma generate`

4. **Build Errors**
   - Clear `.next` folder: `rm -rf .next`
   - Reinstall dependencies: `rm -rf node_modules && npm install`

## Development Workflow

1. **Make Schema Changes**: Edit `prisma/schema.prisma`
2. **Update Database**: Run `npm run db:push`
3. **Create tRPC Routes**: Add to `src/server/api/routers/`
4. **Build Components**: Use shadcn/ui components
5. **Test Changes**: Run `npm run typecheck` and `npm run check`

## Deployment

The application is configured for deployment on Vercel, Netlify, or Docker. See the [T3 Stack deployment guides](https://create.t3.gg/en/deployment/vercel) for detailed instructions.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make changes and run tests
4. Run code quality checks: `npm run check && npm run typecheck`
5. Commit changes and push to your fork
6. Create a pull request

## License

This project is licensed under the MIT License.