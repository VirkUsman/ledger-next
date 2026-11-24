// Builds nothing: run `npm run build` first. Boots `next start` on a free port
// against the scratch database, runs Cypress headless, then stops the server.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

function freePort() {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
    s.on('error', reject);
  });
}

async function waitFor(url, ms = 30000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`${url} did not answer within ${ms} ms`);
}

const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const databaseUrl = process.env.TEST_DATABASE_URL ?? 'postgres://localhost:5432/ledger_next_test';

const server = spawn('npx', ['next', 'start', '-p', String(port)], {
  env: { ...process.env, DATABASE_URL: databaseUrl },
  stdio: ['ignore', 'inherit', 'inherit'],
});
const stop = () => server.kill('SIGTERM');
process.on('exit', stop);
process.on('SIGINT', () => process.exit(130));

let code = 1;
try {
  await waitFor(base);
  const cy = spawn('npx', ['cypress', 'run', '--config', `baseUrl=${base}`], { stdio: 'inherit' });
  code = await new Promise((resolve) => cy.on('exit', (c) => resolve(c ?? 1)));
} catch (err) {
  console.error(err.message);
} finally {
  stop();
}
process.exit(code);
