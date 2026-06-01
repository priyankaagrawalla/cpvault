import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { ensureUserRows } from '../services/userData.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  await ensureUserRows(req.user.id);
  const { rows } = await pool.query('SELECT * FROM platform_handles WHERE user_id = $1', [req.user.id]);
  const h = rows[0];
  res.json({
    codeforces: h?.codeforces_handle || '',
    leetcode: h?.leetcode_handle || '',
    atcoder: h?.atcoder_handle || '',
    codechef: h?.codechef_handle || '',
    hackerrank: h?.hackerrank_handle || '',
  });
});

router.put('/', requireAuth, async (req, res) => {
  const { codeforces, leetcode, atcoder, codechef, hackerrank } = req.body;
  await ensureUserRows(req.user.id);
  await pool.query(
    `UPDATE platform_handles SET
      codeforces_handle = $2, leetcode_handle = $3, atcoder_handle = $4,
      codechef_handle = $5, hackerrank_handle = $6, updated_at = NOW()
     WHERE user_id = $1`,
    [
      req.user.id,
      codeforces?.trim() || null,
      leetcode?.trim() || null,
      atcoder?.trim() || null,
      codechef?.trim() || null,
      hackerrank?.trim() || null,
    ]
  );
  res.json({
    codeforces: codeforces || '',
    leetcode: leetcode || '',
    atcoder: atcoder || '',
    codechef: codechef || '',
    hackerrank: hackerrank || '',
  });
});

export default router;
