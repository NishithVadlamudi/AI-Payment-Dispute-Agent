import { createDatabaseClient, ConfigurationError } from '@/lib/db/client';
import { createStore } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const customers = await createStore(createDatabaseClient()).customers();
    return Response.json({ customers }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof ConfigurationError
            ? error.message
            : 'The demo database is unavailable. Check its connection, migration, and seed.',
      },
      { status: 503 },
    );
  }
}
