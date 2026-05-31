import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { rowToProblem } from '../utils/serialize.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const { rows: sessions } = await pool.query(
    `SELECT * FROM revision_sessions WHERE user_id = $1 ORDER BY generated_at DESC LIMIT 1`,
    [req.user.id]
  );
  const { rows: history } = await pool.query(
    'SELECT * FROM revision_history WHERE user_id = $1 ORDER BY event_date DESC LIMIT 200',
    [req.user.id]
  );

  let revisionProblems = [];
  let revisionGeneratedAt = null;

  if (sessions[0]) {
    revisionGeneratedAt = new Date(sessions[0].generated_at).toISOString();
    const { rows: items } = await pool.query(
      `SELECT ri.revision_status, p.* FROM revision_items ri
       JOIN problems p ON p.id = ri.problem_id WHERE ri.session_id = $1`,
      [sessions[0].id]
    );
    revisionProblems = items.map((row) => ({
      ...rowToProblem(row),
      revisionStatus: row.revision_status,
    }));
  }

  res.json({
    revisionProblems,
    revisionGeneratedAt,
    revisionHistory: history.map((h) => ({
      id: h.id,
      date: new Date(h.event_date).toISOString(),
      type: h.event_type,
    })),
  });
});

router.post('/generate', requireAuth, async (req, res) => {
  const { revisionProblems, revisionGeneratedAt } = req.body;
  await pool.query(
    `DELETE FROM revision_items WHERE session_id IN (
      SELECT id FROM revision_sessions WHERE user_id = $1
    )`,
    [req.user.id]
  );
  await pool.query('DELETE FROM revision_sessions WHERE user_id = $1', [req.user.id]);

  if (!revisionGeneratedAt || !revisionProblems?.length) {
    return res.json({ revisionProblems: [], revisionGeneratedAt: null });
  }

  const { rows: sess } = await pool.query(
    `INSERT INTO revision_sessions (user_id, generated_at) VALUES ($1, $2) RETURNING id`,
    [req.user.id, new Date(revisionGeneratedAt)]
  );

  for (const rp of revisionProblems) {
    const { rows: prob } = await pool.query(
      'SELECT id FROM problems WHERE user_id = $1 AND client_id = $2',
      [req.user.id, String(rp.id)]
    );
    if (prob[0]) {
      await pool.query(
        `INSERT INTO revision_items (session_id, problem_id, revision_status) VALUES ($1,$2,$3)`,
        [sess[0].id, prob[0].id, rp.revisionStatus || 'pending']
      );
    }
  }

  res.json({ revisionProblems, revisionGeneratedAt });
});

router.patch('/items/:clientId', requireAuth, async (req, res) => {
  const { revisionStatus } = req.body;
  const { rows: sessions } = await pool.query(
    `SELECT id FROM revision_sessions WHERE user_id = $1 ORDER BY generated_at DESC LIMIT 1`,
    [req.user.id]
  );
  if (!sessions[0]) return res.status(404).json({ error: 'No active revision session' });

  const { rows: prob } = await pool.query(
    'SELECT id FROM problems WHERE user_id = $1 AND client_id = $2',
    [req.user.id, req.params.clientId]
  );
  if (!prob[0]) return res.status(404).json({ error: 'Problem not found' });

  await pool.query(
    `UPDATE revision_items SET revision_status = $3
     WHERE session_id = $1 AND problem_id = $2`,
    [sessions[0].id, prob[0].id, revisionStatus || 'done']
  );

  if (revisionStatus === 'done') {
    await pool.query(
      `INSERT INTO revision_history (user_id, problem_id, event_date, event_type)
       VALUES ($1, $2, NOW(), 'completed')`,
      [req.user.id, prob[0].id]
    );
  }

  res.json({ ok: true });
});

export default router;
