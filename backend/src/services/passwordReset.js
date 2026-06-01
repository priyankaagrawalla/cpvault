import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { pool } from '../db/pool.js';
import { sendPasswordResetEmail } from './email.js';

const TOKEN_BYTES = 32;
const EXPIRY_HOURS = 1;
const SALT_ROUNDS = 12;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function requestPasswordReset(email) {
  const normalized = email.trim().toLowerCase();
  const { rows } = await pool.query('SELECT id, email FROM users WHERE email = $1', [normalized]);
  const user = rows[0];

  // Always return success message (do not reveal if email exists)
  if (!user) {
    return { ok: true, devToken: null };
  }

  const token = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 3600000);

  await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id]);
  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [user.id, tokenHash, expiresAt]
  );

  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  const resetUrl = `${frontendUrl}?reset=${token}`;

  const emailed = await sendPasswordResetEmail(user.email, resetUrl);

  return {
    ok: true,
    devToken: !emailed && process.env.NODE_ENV !== 'production' ? token : null,
    resetUrl: !emailed && process.env.NODE_ENV !== 'production' ? resetUrl : null,
  };
}

export async function resetPasswordWithToken(token, newPassword) {
  if (!token?.trim() || !newPassword) {
    throw new Error('Token and new password are required');
  }
  if (newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  const tokenHash = hashToken(token.trim());
  const { rows } = await pool.query(
    `SELECT prt.*, u.email FROM password_reset_tokens prt
     JOIN users u ON u.id = prt.user_id
     WHERE prt.token_hash = $1 AND prt.expires_at > NOW()`,
    [tokenHash]
  );
  const row = rows[0];
  if (!row) {
    throw new Error('Invalid or expired reset link. Request a new one.');
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await pool.query('UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1', [
    row.user_id,
    passwordHash,
  ]);
  await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [row.user_id]);

  return { ok: true, email: row.email };
}
