import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { loadFullState, saveFullState } from '../services/userData.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const state = await loadFullState(req.user.id);
    res.json(state);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load data' });
  }
});

router.put('/', requireAuth, async (req, res) => {
  try {
    const state = await saveFullState(req.user.id, req.body);
    res.json(state);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save data' });
  }
});

/** Import from legacy localStorage JSON (cpvault_v4 + handle keys) */
router.post('/import-local', requireAuth, async (req, res) => {
  try {
    const { vault, handles } = req.body;
    if (!vault || typeof vault !== 'object') {
      return res.status(400).json({ error: 'vault object required (cpvault_v4 JSON)' });
    }

    const payload = {
      problems: vault.problems || [],
      notes: vault.notes || [],
      contests: vault.contests || [],
      upsolveProblems: vault.upsolveProblems || [],
      revisionProblems: vault.revisionProblems || [],
      revisionGeneratedAt: vault.revisionGeneratedAt || null,
      revisionHistory: vault.revisionHistory || [],
      contestHistory: vault.contestHistory || [],
      contestPerformances: vault.contestPerformances || [],
      contestsLastFetched: vault.contestsLastFetched || null,
    };

    if (handles) {
      payload.handles = {
        codeforces: handles.codeforces || '',
        leetcode: handles.leetcode || '',
        atcoder: handles.atcoder || '',
      };
    }

    const state = await saveFullState(req.user.id, payload);
    res.json({ message: 'Import successful', state });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Import failed' });
  }
});

export default router;
