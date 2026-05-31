import { pool } from '../db/pool.js';
import {
  rowToProblem,
  rowToNote,
  rowToContest,
  rowToUpsolve,
} from '../utils/serialize.js';
import { rowToPerformance } from './contestAnalytics.js';

export async function ensureUserRows(userId) {
  await pool.query(
    `INSERT INTO profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
  await pool.query(
    `INSERT INTO platform_handles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
  await pool.query(
    `INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
}

export async function loadFullState(userId) {
  await ensureUserRows(userId);

  const baseQueries = await Promise.all([
    pool.query('SELECT * FROM profiles WHERE user_id = $1', [userId]),
    pool.query('SELECT * FROM platform_handles WHERE user_id = $1', [userId]),
    pool.query('SELECT * FROM problems WHERE user_id = $1 ORDER BY created_at DESC', [userId]),
    pool.query('SELECT * FROM notes WHERE user_id = $1 ORDER BY updated_at DESC', [userId]),
    pool.query('SELECT * FROM user_contests WHERE user_id = $1 ORDER BY contest_date ASC', [userId]),
    pool.query('SELECT * FROM user_settings WHERE user_id = $1', [userId]),
    pool.query('SELECT * FROM upsolve_problems WHERE user_id = $1 ORDER BY created_at DESC', [userId]),
    pool.query(
      `SELECT rs.* FROM revision_sessions rs
       WHERE rs.user_id = $1
       ORDER BY rs.generated_at DESC LIMIT 1`,
      [userId]
    ),
    pool.query(
      'SELECT * FROM revision_history WHERE user_id = $1 ORDER BY event_date DESC LIMIT 500',
      [userId]
    ),
    pool.query(
      'SELECT * FROM contest_history WHERE user_id = $1 ORDER BY ended_at DESC LIMIT 200',
      [userId]
    ),
  ]);

  let contestPerfRes = { rows: [] };
  try {
    contestPerfRes = await pool.query(
      'SELECT * FROM contest_performances WHERE user_id = $1 ORDER BY contest_date DESC',
      [userId]
    );
  } catch (err) {
    if (err.code !== '42P01') throw err;
  }

  const [
    profileRes,
    handlesRes,
    problemsRes,
    notesRes,
    contestsRes,
    settingsRes,
    upsolveRes,
    revisionSessionRes,
    revisionHistoryRes,
    contestHistoryRes,
  ] = baseQueries;

  let revisionProblems = [];
  let revisionGeneratedAt = null;

  const session = revisionSessionRes.rows[0];
  if (session) {
    revisionGeneratedAt = new Date(session.generated_at).toISOString();
    const itemsRes = await pool.query(
      `SELECT ri.*, p.* FROM revision_items ri
       JOIN problems p ON p.id = ri.problem_id
       WHERE ri.session_id = $1`,
      [session.id]
    );
    revisionProblems = itemsRes.rows.map((row) => ({
      ...rowToProblem(row),
      revisionStatus: row.revision_status,
    }));
  }

  const revisionHistory = revisionHistoryRes.rows.map((h) => ({
    id: h.id,
    date: new Date(h.event_date).toISOString(),
    type: h.event_type,
    problemId: h.problem_id,
    metadata: h.metadata,
  }));

  const contestHistory = contestHistoryRes.rows.map((h) => ({
    id: h.id,
    contestId: h.contest_id,
    name: h.name,
    platform: h.platform,
    date: new Date(h.contest_date).toISOString(),
    endedAt: new Date(h.ended_at).toISOString(),
    upsolveAdded: h.upsolve_added,
  }));

  const profile = profileRes.rows[0];
  const handles = handlesRes.rows[0];
  const settings = settingsRes.rows[0];

  return {
    profile: {
      displayName: profile?.display_name || '',
    },
    handles: {
      codeforces: handles?.codeforces_handle || '',
      leetcode: handles?.leetcode_handle || '',
      atcoder: handles?.atcoder_handle || '',
    },
    problems: problemsRes.rows.map(rowToProblem),
    notes: notesRes.rows.map(rowToNote),
    contests: contestsRes.rows.map(rowToContest),
    upsolveProblems: upsolveRes.rows.map(rowToUpsolve),
    revisionProblems,
    revisionGeneratedAt,
    revisionHistory,
    contestHistory,
    contestPerformances: contestPerfRes.rows.map(rowToPerformance),
    contestsLastFetched: settings?.contests_last_fetched
      ? new Date(settings.contests_last_fetched).toISOString()
      : null,
    currentPage: 'dashboard',
    pendingImport: [],
    noteTopicFilter: '',
    selectedExplorerTag: null,
  };
}

export async function saveFullState(userId, data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureUserRows(userId);

    if (data.profile) {
      await client.query(
        `UPDATE profiles SET display_name = $2, updated_at = NOW() WHERE user_id = $1`,
        [userId, data.profile.displayName || null]
      );
    }

    if (data.handles) {
      await client.query(
        `UPDATE platform_handles SET
          codeforces_handle = $2, leetcode_handle = $3, atcoder_handle = $4, updated_at = NOW()
         WHERE user_id = $1`,
        [
          userId,
          data.handles.codeforces || null,
          data.handles.leetcode || null,
          data.handles.atcoder || null,
        ]
      );
    }

    if (data.contestsLastFetched !== undefined) {
      await client.query(
        `UPDATE user_settings SET contests_last_fetched = $2, updated_at = NOW() WHERE user_id = $1`,
        [userId, data.contestsLastFetched ? new Date(data.contestsLastFetched) : null]
      );
    }

    if (Array.isArray(data.problems)) {
      await client.query('DELETE FROM problems WHERE user_id = $1', [userId]);
      for (const p of data.problems) {
        await client.query(
          `INSERT INTO problems (
            user_id, client_id, name, platform, url, rating, tags, attempts,
            code, errors, concept, classification, imported, solved_date
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [
            userId,
            String(p.id),
            p.name,
            p.platform,
            p.url || '',
            p.rating || '',
            JSON.stringify(p.tags || []),
            p.attempts || 0,
            p.code || '',
            p.errors || '',
            p.concept || '',
            p.classification || null,
            !!p.imported,
            p.date ? new Date(p.date) : new Date(),
          ]
        );
      }
    }

    if (Array.isArray(data.notes)) {
      await client.query('DELETE FROM notes WHERE user_id = $1', [userId]);
      for (const n of data.notes) {
        await client.query(
          `INSERT INTO notes (user_id, client_id, title, topic, content, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            userId,
            String(n.id),
            n.title,
            n.topic || '',
            n.content || '',
            n.createdAt ? new Date(n.createdAt) : new Date(),
            n.updatedAt ? new Date(n.updatedAt) : new Date(),
          ]
        );
      }
    }

    if (Array.isArray(data.contests)) {
      await client.query('DELETE FROM user_contests WHERE user_id = $1', [userId]);
      for (const c of data.contests) {
        await client.query(
          `INSERT INTO user_contests (
            id, user_id, external_id, name, platform, contest_date, duration_minutes,
            url, source, reminders, fired_reminders, upsolve_added
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [
            String(c.id),
            userId,
            c.externalId || null,
            c.name,
            c.platform,
            new Date(c.date),
            c.duration || 120,
            c.url || '',
            c.source || 'auto',
            JSON.stringify(c.reminders || []),
            JSON.stringify(c.firedReminders || []),
            !!c.upsolveAdded,
          ]
        );
      }
    }

    if (Array.isArray(data.upsolveProblems)) {
      await client.query('DELETE FROM upsolve_problems WHERE user_id = $1', [userId]);
      for (const u of data.upsolveProblems) {
        await client.query(
          `INSERT INTO upsolve_problems (
            user_id, client_id, name, platform, contest_name, contest_id, tags,
            status, url, is_contest_placeholder
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            userId,
            String(u.id),
            u.name,
            u.platform,
            u.contest || '',
            u.contestId ? String(u.contestId) : null,
            JSON.stringify(u.tags || []),
            u.status || 'unsolved',
            u.url || '',
            !!u.isContestPlaceholder,
          ]
        );
      }
    }

    if (data.revisionProblems !== undefined || data.revisionGeneratedAt !== undefined) {
      await client.query(
        `DELETE FROM revision_items WHERE session_id IN (
          SELECT id FROM revision_sessions WHERE user_id = $1
        )`,
        [userId]
      );
      await client.query('DELETE FROM revision_sessions WHERE user_id = $1', [userId]);

      if (data.revisionGeneratedAt && Array.isArray(data.revisionProblems) && data.revisionProblems.length) {
        const { rows: sessRows } = await client.query(
          `INSERT INTO revision_sessions (user_id, generated_at)
           VALUES ($1, $2) RETURNING id`,
          [userId, new Date(data.revisionGeneratedAt)]
        );
        const sessionId = sessRows[0].id;

        for (const rp of data.revisionProblems) {
          const { rows: probRows } = await client.query(
            'SELECT id FROM problems WHERE user_id = $1 AND client_id = $2',
            [userId, String(rp.id)]
          );
          if (probRows[0]) {
            await client.query(
              `INSERT INTO revision_items (session_id, problem_id, revision_status)
               VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
              [sessionId, probRows[0].id, rp.revisionStatus || 'pending']
            );
          }
        }
      }
    }

    if (Array.isArray(data.revisionHistory)) {
      await client.query('DELETE FROM revision_history WHERE user_id = $1', [userId]);
      for (const h of data.revisionHistory) {
        await client.query(
          `INSERT INTO revision_history (user_id, event_date, event_type, metadata)
           VALUES ($1, $2, $3, $4)`,
          [
            userId,
            h.date ? new Date(h.date) : new Date(),
            h.type || 'completed',
            JSON.stringify(h.metadata || {}),
          ]
        );
      }
    }

    if (Array.isArray(data.contestHistory)) {
      await client.query('DELETE FROM contest_history WHERE user_id = $1', [userId]);
      for (const h of data.contestHistory) {
        await client.query(
          `INSERT INTO contest_history (
            user_id, contest_id, name, platform, contest_date, duration_minutes, ended_at, upsolve_added
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            userId,
            h.contestId ? String(h.contestId) : null,
            h.name,
            h.platform,
            new Date(h.date),
            h.duration || null,
            h.endedAt ? new Date(h.endedAt) : new Date(),
            !!h.upsolveAdded,
          ]
        );
      }
    }

    if (Array.isArray(data.contestPerformances)) {
      try {
        await client.query('DELETE FROM contest_performances WHERE user_id = $1', [userId]);
        for (const p of data.contestPerformances) {
          await client.query(
            `INSERT INTO contest_performances (
              user_id, client_id, contest_id, contest_name, platform, contest_date,
              duration_minutes, solved_live, problems, notes, logged_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [
              userId,
              String(p.id),
              p.contestId ? String(p.contestId) : null,
              p.contestName || p.name,
              p.platform,
              new Date(p.contestDate || p.date),
              p.duration || 120,
              p.solvedLive ?? 0,
              JSON.stringify(p.problems || []),
              p.notes || '',
              p.loggedAt ? new Date(p.loggedAt) : new Date(),
            ]
          );
        }
      } catch (err) {
        if (err.code !== '42P01') throw err;
      }
    }

    await client.query('COMMIT');
    return loadFullState(userId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
