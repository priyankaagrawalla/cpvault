import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth, requireAdmin);

router.get('/users', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.username, u.role, u.created_at,
            p.display_name,
            (SELECT COUNT(*)::int FROM problems WHERE user_id = u.id) AS problem_count,
            (SELECT COUNT(*)::int FROM notes WHERE user_id = u.id) AS note_count
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     ORDER BY u.created_at DESC`
  );
  res.json(
    rows.map((r) => ({
      id: r.id,
      email: r.email,
      username: r.username,
      role: r.role,
      displayName: r.display_name,
      problemCount: r.problem_count,
      noteCount: r.note_count,
      createdAt: r.created_at,
    }))
  );
});

router.get('/users/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.username, u.role, u.created_at, p.display_name,
            h.codeforces_handle, h.leetcode_handle, h.atcoder_handle
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     LEFT JOIN platform_handles h ON h.user_id = u.id
     WHERE u.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });

  const userId = rows[0].id;
  const [problems, notes, contests] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS c FROM problems WHERE user_id = $1', [userId]),
    pool.query('SELECT COUNT(*)::int AS c FROM notes WHERE user_id = $1', [userId]),
    pool.query('SELECT COUNT(*)::int AS c FROM user_contests WHERE user_id = $1', [userId]),
  ]);

  res.json({
    id: rows[0].id,
    email: rows[0].email,
    username: rows[0].username,
    role: rows[0].role,
    displayName: rows[0].display_name,
    handles: {
      codeforces: rows[0].codeforces_handle,
      leetcode: rows[0].leetcode_handle,
      atcoder: rows[0].atcoder_handle,
    },
    stats: {
      problems: problems.rows[0].c,
      notes: notes.rows[0].c,
      contests: contests.rows[0].c,
    },
    createdAt: rows[0].created_at,
  });
});

export default router;
