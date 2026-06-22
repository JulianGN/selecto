import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env.DATABASE_URL || 'file:local.db';
const isPostgres = databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://');

export default defineConfig({
  schema: isPostgres ? './src/db/schema/pg.ts' : './src/db/schema/sqlite.ts',
  out: isPostgres ? './drizzle/pg' : './drizzle/sqlite',
  dialect: isPostgres ? 'postgresql' : 'sqlite',
  dbCredentials: {
    url: databaseUrl,
  },
});
