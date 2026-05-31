/** Build contest performance analytics from performances + upsolve queue */

function contestKey(contestId, name) {
  if (contestId) return String(contestId).toLowerCase();
  return (name || '').toLowerCase().trim();
}

function countProblemStatuses(problems, solvedLive) {
  const list = problems || [];
  const live = list.filter((p) => p.status === 'live').length;
  const upsolved = list.filter((p) => p.status === 'upsolved').length;
  const missed = list.filter((p) => p.status === 'missed').length;
  const pending = list.filter((p) => p.status === 'pending').length;
  const liveCount = Math.max(live, solvedLive || 0, 0);
  const detailedTotal = live + upsolved + missed + pending;
  const total = detailedTotal > 0 ? detailedTotal : liveCount + upsolved + missed + pending;
  return { live: liveCount, upsolved, missed, pending, total };
}

export function buildContestAnalytics(performances = [], upsolveProblems = [], contestHistory = []) {
  const perfByKey = new Map();

  for (const p of performances) {
    const key = contestKey(p.contestId, p.contestName || p.name);
    const counts = countProblemStatuses(p.problems, p.solvedLive);
    perfByKey.set(key, {
      id: p.id || p.clientId,
      contestId: p.contestId,
      name: p.contestName || p.name,
      platform: p.platform,
      date: p.contestDate || p.date,
      duration: p.duration || p.durationMinutes || 120,
      notes: p.notes || '',
      ...counts,
      source: 'logged',
    });
  }

  // Enrich from upsolve problems grouped by contest
  const upsolveGroups = {};
  for (const u of upsolveProblems || []) {
    if (u.isContestPlaceholder) continue;
    const key = contestKey(u.contestId, u.contest);
    if (!key) continue;
    if (!upsolveGroups[key]) {
      upsolveGroups[key] = { upsolved: 0, pending: 0, missed: 0, platform: u.platform, name: u.contest };
    }
    if (u.status === 'solved') upsolveGroups[key].upsolved++;
    else upsolveGroups[key].pending++;
  }

  for (const [key, g] of Object.entries(upsolveGroups)) {
    const existing = perfByKey.get(key);
    if (existing) {
      existing.upsolved = Math.max(existing.upsolved, g.upsolved);
      existing.pending = Math.max(existing.pending, g.pending);
      existing.total = Math.max(existing.total, existing.live + existing.upsolved + existing.missed + existing.pending);
    } else {
      perfByKey.set(key, {
        contestId: null,
        name: g.name || 'Unknown contest',
        platform: g.platform || 'Codeforces',
        date: null,
        live: 0,
        upsolved: g.upsolved,
        missed: 0,
        pending: g.pending,
        total: g.upsolved + g.pending,
        source: 'upsolve_only',
      });
    }
  }

  // Include contest history entries without performance logs
  for (const h of contestHistory || []) {
    const key = contestKey(h.contestId, h.name);
    if (perfByKey.has(key)) continue;
    perfByKey.set(key, {
      contestId: h.contestId,
      name: h.name,
      platform: h.platform,
      date: h.date,
      live: 0,
      upsolved: 0,
      missed: 0,
      pending: h.upsolveAdded ? 1 : 0,
      total: 0,
      source: 'history_only',
    });
  }

  const contests = [...perfByKey.values()].sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return db - da;
  });

  let totalLive = 0;
  let totalUpsolved = 0;
  let totalMissed = 0;
  let totalPending = 0;
  const byPlatform = {};

  for (const c of contests) {
    totalLive += c.live;
    totalUpsolved += c.upsolved;
    totalMissed += c.missed;
    totalPending += c.pending;
    const plat = c.platform || 'Other';
    if (!byPlatform[plat]) {
      byPlatform[plat] = { contests: 0, live: 0, upsolved: 0, missed: 0, pending: 0 };
    }
    byPlatform[plat].contests++;
    byPlatform[plat].live += c.live;
    byPlatform[plat].upsolved += c.upsolved;
    byPlatform[plat].missed += c.missed;
    byPlatform[plat].pending += c.pending;
  }

  const contestCount = contests.length;
  const upsolveDenominator = totalUpsolved + totalMissed + totalPending;
  const upsolveRate = upsolveDenominator > 0 ? Math.round((totalUpsolved / upsolveDenominator) * 100) : 0;
  const liveSolveRate =
    totalLive + totalMissed + totalPending > 0
      ? Math.round((totalLive / (totalLive + totalUpsolved + totalMissed + totalPending)) * 100)
      : 0;

  const avgLivePerContest = contestCount > 0 ? Math.round((totalLive / contestCount) * 10) / 10 : 0;

  const bestPlatform = Object.entries(byPlatform).sort((a, b) => b[1].live - a[1].live)[0];

  const insights = [];
  if (contestCount === 0) {
    insights.push('Log your first contest result to start tracking performance.');
  } else {
    insights.push(`You've logged ${contestCount} contest${contestCount > 1 ? 's' : ''} with ${totalLive} live solve${totalLive !== 1 ? 's' : ''}.`);
    if (upsolveDenominator > 0) {
      insights.push(`Upsolve completion rate: ${upsolveRate}% (${totalUpsolved}/${upsolveDenominator} missed problems recovered).`);
    }
    if (totalPending > 0) {
      insights.push(`${totalPending} problem${totalPending > 1 ? 's' : ''} still waiting in your upsolve queue.`);
    }
    if (bestPlatform?.[1]?.live > 0) {
      insights.push(`Strongest platform by live solves: ${bestPlatform[0]} (${bestPlatform[1].live} total).`);
    }
    const recent = contests.filter((c) => c.date).slice(0, 3);
    if (recent.length >= 2) {
      const recentLive = recent.reduce((s, c) => s + c.live, 0);
      insights.push(`Last ${recent.length} contests: ${recentLive} live solve${recentLive !== 1 ? 's' : ''}.`);
    }
  }

  return {
    summary: {
      contestCount,
      totalLive,
      totalUpsolved,
      totalMissed,
      totalPending,
      upsolveRate,
      liveSolveRate,
      avgLivePerContest,
    },
    byPlatform,
    contests,
    insights,
  };
}

export function rowToPerformance(row) {
  return {
    id: row.client_id || row.id,
    dbId: row.id,
    contestId: row.contest_id,
    contestName: row.contest_name,
    name: row.contest_name,
    platform: row.platform,
    contestDate: new Date(row.contest_date).toISOString(),
    date: new Date(row.contest_date).toISOString(),
    duration: row.duration_minutes,
    solvedLive: row.solved_live,
    problems: row.problems || [],
    notes: row.notes || '',
    loggedAt: new Date(row.logged_at).toISOString(),
  };
}
