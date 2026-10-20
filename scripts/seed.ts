import { createClient } from '@supabase/supabase-js';
import { createSeedData } from '../src/lib/demo/seed-data';

async function seed() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local before seeding.');
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const data = createSeedData();
  // Fixed IDs make this repeatable without deleting unrelated records.
  for (const [table, records] of Object.entries(data)) {
    const { error } = await db
      .from(table)
      .upsert(records as Record<string, unknown>[], { onConflict: 'id' });
    if (error)
      throw new Error(
        `Could not seed ${table}. Apply the migration first. Database code: ${error.code}`,
      );
    console.log(`Seeded ${records.length} ${table}`);
  }
}

seed().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Seed failed.');
  process.exitCode = 1;
});
