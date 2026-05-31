import pg from 'pg';
import { config } from '../config.js';

const useSsl =
  process.env.DATABASE_SSL === 'true' ||
  /neon\.tech|sslmode=require/i.test(config.databaseUrl || '');

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});
