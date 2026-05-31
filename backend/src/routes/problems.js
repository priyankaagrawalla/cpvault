import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { rowToProblem } from '../utils/serialize.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM problems WHERE user_id = $1 ORDER BY created_at DESC',
    [req.user.id]
  );
  res.json(rows.map(rowToProblem));
});

router.post('/', requireAuth, async (req, res) => {
  const p = req.body;
  const clientId = String(p.id || Date.now() + Math.random());
  const { rows } = await pool.query(
    `INSERT INTO problems (
      user_id, client_id, name, platform, url, rating, tags, attempts,
      code, errors, concept, classification, imported, solved_date
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [
      req.user.id, clientId, p.name, p.platform, p.url || '', p.rating || '',
      JSON.stringify(p.tags || []), p.attempts || 0, p.code || '', p.errors || '',
      p.concept || '', p.classification || null, !!p.imported,
      p.date ? new Date(p.date) : new Date(),
    ]
  );
  res.status(201).json(rowToProblem(rows[0]));
});

router.put('/:clientId', requireAuth, async (req, res) => {
  const p = req.body;
  const { rows } = await pool.query(
    `UPDATE problems SET
      name=$3, platform=$4, url=$5, rating=$6, tags=$7, attempts=$8,
      code=$9, errors=$10, concept=$11, classification=$12, imported=$13,
      solved_date=$14, updated_at=NOW()
     WHERE user_id=$1 AND client_id=$2 RETURNING *`,
    [
      req.user.id, req.params.clientId, p.name, p.platform, p.url || '', p.rating || '',
      JSON.stringify(p.tags || []), p.attempts || 0, p.code || '', p.errors || '',
      p.concept || '', p.classification || null, !!p.imported,
      p.date ? new Date(p.date) : new Date(),
    ]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Problem not found' });
  res.json(rowToProblem(rows[0]));
});

router.delete('/:clientId', requireAuth, async (req, res) => {
  const { rowCount } = await pool.query(
    'DELETE FROM problems WHERE user_id = $1 AND client_id = $2',
    [req.user.id, req.params.clientId]
  );
  if (!rowCount) return res.status(404).json({ error: 'Problem not found' });
  res.json({ ok: true });
});

export default router;
