import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

// Add global connection pool caching to persist across hot-reloads
declare global {
  var _postgresPool: Pool | undefined;
}

// Function to create or retrieve the connection pool.
export const createPool = () => {
  if (!global._postgresPool) {
    const supabasePassword = process.env.SUPABASE_PASSWORD || process.env.SUPABASE_DB_PASSWORD;
    const supabaseHost = process.env.SUPABASE_HOST;
    const isSupabaseConfigured = Boolean(supabasePassword?.trim() && supabaseHost?.trim());

    if (isSupabaseConfigured) {
      console.log(`Connecting to Supabase PostgreSQL at ${supabaseHost}...`);
      global._postgresPool = new Pool({
        host: supabaseHost,
        port: Number(process.env.SUPABASE_PORT || 5432),
        user: process.env.SUPABASE_USER || 'postgres',
        password: supabasePassword,
        database: process.env.SUPABASE_DATABASE || 'postgres',
        ssl: { rejectUnauthorized: false },
        max: 10,
        connectionTimeoutMillis: 15000,
      });
    } else {
      if (supabasePassword || supabaseHost) {
        throw new Error('Supabase chưa được cấu hình đầy đủ. Cần đặt SUPABASE_HOST và SUPABASE_PASSWORD trong .env.');
      }
      global._postgresPool = new Pool({
        host: process.env.SQL_HOST,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME,
        max: 10,
        connectionTimeoutMillis: 15000,
      });
    }

    // Prevent unhandled pool-level errors from crashing the application
    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

// Create or retrieve the pool instance.
const pool = createPool();

// Initialize Drizzle with the pool and schema.
export const db = drizzle(pool, { schema });
