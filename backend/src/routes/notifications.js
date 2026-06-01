import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { pool } from '../db/pool.js';
import { sendContestEmail } from '../services/email.js';

const router = Router();

router.post('/contest-reminders', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT email FROM users WHERE id = $1', [req.user.id]);
    const email = rows[0]?.email;
    if (!email) return res.status(400).json({ error: 'No email on account' });

    const prefsRes = await pool.query('SELECT prefs FROM user_settings WHERE user_id = $1', [
      req.user.id,
    ]);
    const prefs = prefsRes.rows[0]?.prefs || {};
    const to = prefs.emailAddress || email;
    const ok = await sendContestEmail(to, prefs);
    res.json({ ok, sent: ok ? 1 : 0 });
  } catch (e) {
    next(e);
  }
});

/** Cron: POST with header x-cron-secret: NOTIFY_CRON_SECRET */
router.post('/cron/contest-reminders', async (req, res, next) => {
  try {
    const cronSecret = process.env.NOTIFY_CRON_SECRET;
    if (!cronSecret || req.headers['x-cron-secret'] !== cronSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { rows } = await pool.query(
      `SELECT u.email, us.prefs
       FROM users u
       JOIN user_settings us ON us.user_id = u.id
       WHERE (us.prefs->>'emailEnabled')::boolean = true`
    );
    let sent = 0;
    for (const row of rows) {
      const to = row.prefs?.emailAddress || row.email;
      if (!to) continue;
      const ok = await sendContestEmail(to, row.prefs || {});
      if (ok) sent++;
    }
    res.json({ ok: true, sent });
  } catch (e) {
    next(e);
  }
});

export default router;
