import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { ensureUserRows } from '../services/userData.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  await ensureUserRows(req.user.id);
  const { rows } = await pool.query('SELECT * FROM profiles WHERE user_id = $1', [req.user.id]);
  const p = rows[0];
  res.json({
    displayName: p?.display_name || '',
    username: req.user.username,
    email: req.user.email,
  });
});

router.put('/', requireAuth, async (req, res) => {
  const { displayName } = req.body;
  await ensureUserRows(req.user.id);
  await pool.query(
    `UPDATE profiles SET display_name = $2, updated_at = NOW() WHERE user_id = $1`,
    [req.user.id, displayName?.trim() || null]
  );
  res.json({ displayName: displayName?.trim() || '' });
});

export default router;
