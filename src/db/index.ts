import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

const globalForDb = globalThis as unknown as { ledgerPool?: pg.Pool };

function pool(): pg.Pool {
  if (!globalForDb.ledgerPool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    globalForDb.ledgerPool = new pg.Pool({ connectionString: url, max: 5 });
  }
  return globalForDb.ledgerPool;
}

export function db() {
  return drizzle(pool(), { schema });
}

export async function closeDb() {
  await globalForDb.ledgerPool?.end();
  globalForDb.ledgerPool = undefined;
}

export { schema };
