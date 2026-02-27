import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

let cachedPool: Pool | null = null;
let cachedDb: NodePgDatabase<typeof schema> | null = null;
let cachedUrl: string | null = null;

export type AusDashDb = NodePgDatabase<typeof schema>;

export function getDb(databaseUrl: string | undefined = process.env.DATABASE_URL): AusDashDb {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for postgres backend");
  }

  if (cachedDb && cachedPool && cachedUrl === databaseUrl) {
    return cachedDb;
  }

  const pool = new Pool({
    connectionString: databaseUrl
  });
  const db = drizzle(pool, { schema });

  cachedPool = pool;
  cachedDb = db;
  cachedUrl = databaseUrl;

  return db;
}

export async function closeDb(): Promise<void> {
  if (!cachedPool) {
    return;
  }

  await cachedPool.end();
  cachedPool = null;
  cachedDb = null;
  cachedUrl = null;
}
