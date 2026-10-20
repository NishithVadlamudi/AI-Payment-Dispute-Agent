import { randomBytes, createHmac } from 'node:crypto';
import { chmodSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parseEnv } from 'node:util';
import { setTimeout } from 'node:timers/promises';

const file = '.env.test-db';

function token(role: string, secret: string) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ role, exp: Math.floor(Date.now() / 1000) + 365 * 86400 }),
  ).toString('base64url');
  const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

if (!existsSync(file)) {
  const secret = randomBytes(32).toString('hex');
  writeFileSync(
    file,
    [
      `TEST_DB_PASSWORD=${randomBytes(24).toString('hex')}`,
      `TEST_JWT_SECRET=${secret}`,
      'SUPABASE_URL=http://127.0.0.1:54321',
      `SUPABASE_SERVICE_ROLE_KEY=${token('service_role', secret)}`,
      `SUPABASE_ANON_KEY=${token('anon', secret)}`,
      'AI_PROVIDER=gemini',
      'GEMINI_MODEL=gemini-3.5-flash-lite',
      '',
    ].join('\n'),
    { mode: 0o600 },
  );
  console.log('Generated ignored, test-only database credentials in .env.test-db.');
}

// Restrictive cloud umasks otherwise make bind-mounted SQL unreadable to Postgres.
for (const path of [
  'supabase/test/bootstrap.sql',
  'supabase/test/nginx.conf',
  'supabase/migrations/0001_foundation.sql',
])
  chmodSync(path, 0o644);

const result = spawnSync(
  'docker',
  ['compose', '--env-file', file, '-f', 'compose.test.yml', 'up', '-d', '--wait'],
  { stdio: 'inherit' },
);
if (result.status !== 0) process.exit(result.status ?? 1);
// Init scripts only run on an empty volume. Apply later migrations to retained
// harness volumes without destroying seeded data. The journal is not REST-exposed.
const sql = (input: string) => {
  const execution = spawnSync('docker', ['compose', '--env-file', file, '-f', 'compose.test.yml',
    'exec', '-T', 'db', 'psql', '-X', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'],
    { input, encoding: 'utf8' });
  if (execution.status !== 0) {
    console.error(execution.stderr || 'Could not apply harness migrations.');
    process.exit(execution.status ?? 1);
  }
};
sql('create schema if not exists test_harness; create table if not exists test_harness.migrations (name text primary key);');
for (const migration of readdirSync('supabase/migrations').filter((name) => /^\d+_[a-z_]+\.sql$/.test(name) && name !== '0001_foundation.sql').sort()) {
  const contents = readFileSync(`supabase/migrations/${migration}`, 'utf8').replace(/^begin;\s*/i, '').replace(/commit;\s*$/i, '');
  sql(`begin;
lock table test_harness.migrations in exclusive mode;
select not exists(select 1 from test_harness.migrations where name = '${migration}') as apply_migration \\gset
\\if :apply_migration
${contents}
insert into test_harness.migrations(name) values ('${migration}');
\\endif
commit;`);
}
const config = parseEnv(readFileSync(file, 'utf8'));
let ready = false;
for (let attempt = 0; attempt < 20; attempt++) {
  try {
    const response = await fetch('http://127.0.0.1:54321/rest/v1/customers?select=id&limit=1', {
      headers: { Authorization: `Bearer ${config.SUPABASE_SERVICE_ROLE_KEY}` },
      signal: AbortSignal.timeout(1500),
    });
    if (response.ok && Array.isArray(await response.json())) {
      ready = true;
      break;
    }
  } catch {
    /* PostgREST may still be loading its initial schema cache. */
  }
  await setTimeout(500);
}
if (!ready) {
  console.error('The test database did not become ready. Inspect Docker Compose logs.');
  process.exit(1);
}
console.log(
  'Test database started. This is a Postgres/PostgREST harness, not the full Supabase platform.',
);
console.log(
  'For this local-only database, copy .env.test-db to .env.local if you have no existing configuration, then run npm run db:seed.',
);
