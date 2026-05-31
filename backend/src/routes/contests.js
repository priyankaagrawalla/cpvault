import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { ensureUserRows } from '../services/userData.js';
import { rowToContest } from '../utils/serialize.js';
import { buildContestAnalytics, rowToPerformance } from '../services/contestAnalytics.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM user_contests WHERE user_id = $1 ORDER BY contest_date ASC',
    [req.user.id]
  );
  const { rows: settings } = await pool.query(
    'SELECT contests_last_fetched FROM user_settings WHERE user_id = $1',
    [req.user.id]
  );
  res.json({
    contests: rows.map(rowToContest),
    contestsLastFetched: settings[0]?.contests_last_fetched
      ? new Date(settings[0].contests_last_fetched).toISOString()
      : null,
  });
});

router.put('/', requireAuth, async (req, res) => {
  const { contests, contestsLastFetched } = req.body;
  await ensureUserRows(req.user.id);

  await pool.query('DELETE FROM user_contests WHERE user_id = $1', [req.user.id]);
  for (const c of contests || []) {
    await pool.query(
      `INSERT INTO user_contests (
        id, user_id, external_id, name, platform, contest_date, duration_minutes,
        url, source, reminders, fired_reminders, upsolve_added
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        String(c.id), req.user.id, c.externalId || null, c.name, c.platform,
        new Date(c.date), c.duration || 120, c.url || '', c.source || 'auto',
        JSON.stringify(c.reminders || []), JSON.stringify(c.firedReminders || []),
        !!c.upsolveAdded,
      ]
    );
  }

  if (contestsLastFetched !== undefined) {
    await pool.query(
      `UPDATE user_settings SET contests_last_fetched = $2, updated_at = NOW() WHERE user_id = $1`,
      [req.user.id, contestsLastFetched ? new Date(contestsLastFetched) : null]
    );
  }

  res.json({ ok: true });
});

router.get('/analytics', requireAuth, async (req, res) => {
  try {
    const [perfRes, upsolveRes, historyRes] = await Promise.all([
      pool.query(
        'SELECT * FROM contest_performances WHERE user_id = $1 ORDER BY contest_date DESC',
        [req.user.id]
      ),
      pool.query('SELECT * FROM upsolve_problems WHERE user_id = $1', [req.user.id]),
      pool.query('SELECT * FROM contest_history WHERE user_id = $1 ORDER BY ended_at DESC', [req.user.id]),
    ]);

    const performances = perfRes.rows.map(rowToPerformance);
    const upsolveProblems = upsolveRes.rows.map((u) => ({
      contestId: u.contest_id,
      contest: u.contest_name,
      platform: u.platform,
      status: u.status,
      isContestPlaceholder: u.is_contest_placeholder,
    }));
    const contestHistory = historyRes.rows.map((h) => ({
      contestId: h.contest_id,
      name: h.name,
      platform: h.platform,
      date: new Date(h.contest_date).toISOString(),
      upsolveAdded: h.upsolve_added,
    }));

    res.json(buildContestAnalytics(performances, upsolveProblems, contestHistory));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to compute analytics' });
  }
});

router.get('/history', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM contest_history WHERE user_id = $1 ORDER BY ended_at DESC',
    [req.user.id]
  );
  res.json(
    rows.map((h) => ({
      id: h.id,
      contestId: h.contest_id,
      name: h.name,
      platform: h.platform,
      date: new Date(h.contest_date).toISOString(),
      endedAt: new Date(h.ended_at).toISOString(),
      upsolveAdded: h.upsolve_added,
    }))
  );
});

router.post('/history', requireAuth, async (req, res) => {
  const h = req.body;
  const { rows } = await pool.query(
    `INSERT INTO contest_history (
      user_id, contest_id, name, platform, contest_date, duration_minutes, ended_at, upsolve_added
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
      req.user.id, h.contestId ? String(h.contestId) : null, h.name, h.platform,
      new Date(h.date), h.duration || null, h.endedAt ? new Date(h.endedAt) : new Date(),
      !!h.upsolveAdded,
    ]
  );
  res.status(201).json(rows[0]);
});

export default router;
