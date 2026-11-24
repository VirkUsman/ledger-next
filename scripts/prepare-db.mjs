// Creates the scratch database if it is missing, then migrates it.
import pg from 'pg';
import { migrate } from './migrate.mjs';

const url = process.env.TEST_DATABASE_URL ?? 'postgres://localhost:5432/ledger_next_test';
const target = new URL(url);
const dbName = target.pathname.slice(1);
if (!/^[a-z0-9_]+$/.test(dbName)) throw new Error(`odd database name: ${dbName}`);

const admin = new URL(url);
admin.pathname = '/postgres';
const client = new pg.Client({ connectionString: admin.toString() });
await client.connect();
const found = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
if (found.rowCount === 0) await client.query(`CREATE DATABASE ${dbName}`);
await client.end();

await migrate(url);
