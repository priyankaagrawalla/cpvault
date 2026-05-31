import { pool } from '../src/db/pool.js';

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/make-admin.js <email>');
  process.exit(1);
}

const { rowCount } = await pool.query(
  `UPDATE users SET role = 'admin' WHERE email = $1`,
  [email.trim().toLowerCase()]
);

if (!rowCount) {
  console.error('User not found:', email);
  process.exit(1);
}

console.log('Admin role granted to', email);
await pool.end();
