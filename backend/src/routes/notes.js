import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { rowToNote } from '../utils/serialize.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM notes WHERE user_id = $1 ORDER BY updated_at DESC',
    [req.user.id]
  );
  res.json(rows.map(rowToNote));
});

router.post('/', requireAuth, async (req, res) => {
  const n = req.body;
  const clientId = String(n.id || Date.now() + Math.random());
  const now = new Date();
  const { rows } = await pool.query(
    `INSERT INTO notes (user_id, client_id, title, topic, content, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [req.user.id, clientId, n.title, n.topic || '', n.content || '', now, now]
  );
  res.status(201).json(rowToNote(rows[0]));
});

router.put('/:clientId', requireAuth, async (req, res) => {
  const n = req.body;
  const { rows } = await pool.query(
    `UPDATE notes SET title=$3, topic=$4, content=$5, updated_at=NOW()
     WHERE user_id=$1 AND client_id=$2 RETURNING *`,
    [req.user.id, req.params.clientId, n.title, n.topic || '', n.content || '']
  );
  if (!rows[0]) return res.status(404).json({ error: 'Note not found' });
  res.json(rowToNote(rows[0]));
});

router.delete('/:clientId', requireAuth, async (req, res) => {
  const { rowCount } = await pool.query(
    'DELETE FROM notes WHERE user_id = $1 AND client_id = $2',
    [req.user.id, req.params.clientId]
  );
  if (!rowCount) return res.status(404).json({ error: 'Note not found' });
  res.json({ ok: true });
});

export default router;
