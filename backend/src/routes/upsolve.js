import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { rowToUpsolve } from '../utils/serialize.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM upsolve_problems WHERE user_id = $1 ORDER BY created_at DESC',
    [req.user.id]
  );
  res.json(rows.map(rowToUpsolve));
});

router.post('/', requireAuth, async (req, res) => {
  const u = req.body;
  const clientId = String(u.id || Date.now());
  const { rows } = await pool.query(
    `INSERT INTO upsolve_problems (
      user_id, client_id, name, platform, contest_name, contest_id, tags, status, url, is_contest_placeholder
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [
      req.user.id, clientId, u.name, u.platform, u.contest || '', u.contestId ? String(u.contestId) : null,
      JSON.stringify(u.tags || []), u.status || 'unsolved', u.url || '', !!u.isContestPlaceholder,
    ]
  );
  res.status(201).json(rowToUpsolve(rows[0]));
});

router.patch('/:clientId', requireAuth, async (req, res) => {
  const u = req.body;
  const { rows } = await pool.query(
    `UPDATE upsolve_problems SET
      name=$3, platform=$4, contest_name=$5, tags=$6, status=$7, url=$8, updated_at=NOW()
     WHERE user_id=$1 AND client_id=$2 RETURNING *`,
    [
      req.user.id, req.params.clientId, u.name, u.platform, u.contest || '',
      JSON.stringify(u.tags || []), u.status, u.url || '',
    ]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rowToUpsolve(rows[0]));
});

router.delete('/:clientId', requireAuth, async (req, res) => {
  const { rowCount } = await pool.query(
    'DELETE FROM upsolve_problems WHERE user_id = $1 AND client_id = $2',
    [req.user.id, req.params.clientId]
  );
  if (!rowCount) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

export default router;
