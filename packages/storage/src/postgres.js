import { RelationalOwnerOpsStore } from './relational-store.js';

export async function createPostgresOwnerOpsStore(options = {}) {
  const connectionString = options.connectionString || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL required for PostgreSQL storage.');

  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString, ...(options.poolOptions || {}) });
  return {
    pool,
    store: new RelationalOwnerOpsStore({ client: pool }),
    async close() {
      await pool.end();
    }
  };
}
