import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import { drizzle as drizzleSqlite } from 'drizzle-orm/libsql';
import postgres from 'postgres';
import { createClient } from '@libsql/client';
import * as pgSchema from './schema/pg';
import * as sqliteSchema from './schema/sqlite';

const databaseUrl = process.env.DATABASE_URL || 'file:local.db';
const isPostgres = databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://');

export let db: any;
export let schema: any;

if (isPostgres) {
  const queryClient = postgres(databaseUrl);
  db = drizzlePg(queryClient, { schema: pgSchema });
  schema = pgSchema;
} else {
  const client = createClient({ url: databaseUrl });
  db = drizzleSqlite(client, { schema: sqliteSchema });
  schema = sqliteSchema;
}
