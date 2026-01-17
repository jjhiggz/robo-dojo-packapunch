# Database Migrations

This project uses [Drizzle ORM](https://orm.drizzle.team/) for database migrations.

## Running Migrations

When you make changes to the database schema (`src/db/schema.ts`), follow these steps:

### 1. Generate migration files

```bash
npm run db:generate
```

This compares your schema to the existing migrations and generates new SQL migration files in the `drizzle/` folder.

### 2. Apply migrations

```bash
npm run db:migrate
```

This runs `drizzle-kit migrate` to apply pending migrations to your database.

## Other Useful Commands

- `npm run db:push` - Push schema changes directly (useful for development, skips migration files)
- `npm run db:pull` - Pull schema from existing database
- `npm run db:studio` - Open Drizzle Studio to browse your database
- `npm run db:seed` - Seed the database with sample data

## Production Deployments

Migrations run automatically during the Vercel build via the `vercel-build` script, which executes `tsx scripts/migrate.ts` before building.

If a migration fails to apply during deployment, you can run it manually:

```bash
DATABASE_URL="your-production-url" NODE_ENV=production npx tsx scripts/migrate.ts
```



