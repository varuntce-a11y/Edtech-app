import { createConnection } from 'node:net';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

const port = Number(process.env.PGPORT ?? 5432);
const dataDirectory = resolve(process.cwd(), 'data', 'postgres');
const dataMarker = resolve(dataDirectory, 'PG_VERSION');
const database = process.env.PGDATABASE ?? 'upskillin';
const user = process.env.PGUSER ?? 'upskillin';
const password = process.env.PGPASSWORD ?? 'upskillin-local-only';

function isPortOpen() {
  return new Promise((resolveResult) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    socket.setTimeout(700);
    socket.once('connect', () => {
      socket.destroy();
      resolveResult(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolveResult(false);
    });
    socket.once('error', () => resolveResult(false));
  });
}

if (await isPortOpen()) {
  throw new Error(`Port ${port} already has a database listener. Configure DATABASE_URL to use that PostgreSQL instance instead.`);
}

await mkdir(dataDirectory, { recursive: true });
const postgres = new EmbeddedPostgres({
  databaseDir: dataDirectory,
  user,
  password,
  port,
  persistent: true,
  onLog: (message) => process.stdout.write(`[postgres] ${message}`),
  onError: (error) => process.stderr.write(`[postgres] ${error}\n`),
});

if (!existsSync(dataMarker)) {
  await postgres.initialise();
}

await postgres.start();
const client = postgres.getPgClient();
await client.connect();
const existingDatabase = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
if (existingDatabase.rowCount === 0) {
  await postgres.createDatabase(database);
}
await client.end();

console.log(`Local PostgreSQL is ready at 127.0.0.1:${port}/${database}. Press Ctrl+C to stop it.`);
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  await postgres.stop();
  process.exit(0);
}

process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
