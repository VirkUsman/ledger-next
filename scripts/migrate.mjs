// Applies db/migrations/*.sql in filename order. Each file is idempotent.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';

export async function migrate(url) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const dir = fileURLToPath(new URL('../db/migrations/', import.meta.url));
    const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
    for (const f of files) {
      await client.query(await readFile(join(dir, f), 'utf8'));
    }
    return files.length;
  } finally {
    await client.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  console.log(`applied ${await migrate(url)} migration file(s)`);
}
