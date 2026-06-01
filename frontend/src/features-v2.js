/**
 * CP Vault v2 features — sync, upsolve UI, goals, revision, recommendations,
 * bulk actions, duplicates, custom tags, global search, calendar, exports, etc.
 */

const REVISION_INTERVALS = [7, 14, 30, 90, 180];

export function defaultPrefs() {
  return {
    goals: { dailyProblems: 1, weeklyProblems: 7, weeklyContests: 1 },
    customTags: [],
    tagAliases: {},
    sync: { enabled: true, intervalHours: 24, lastSyncAt: null, platforms: ['cf', 'lc', 'at', 'cc'] },
    emailEnabled: false,
    emailAddress: '',
    ratingHistory: { codeforces: [], leetcode: [] },
  };
}

export function ensurePrefs(state) {
  if (!state.prefs || typeof state.prefs !== 'object') state.prefs = defaultPrefs();
  const d = defaultPrefs();
  state.prefs.goals = { ...d.goals, ...(state.prefs.goals || {}) };
  state.prefs.sync = { ...d.sync, ...(state.prefs.sync || {}) };
  state.prefs.customTags = state.prefs.customTags || [];
  state.prefs.tagAliases = state.prefs.tagAliases || {};
  state.prefs.ratingHistory = state.prefs.ratingHistory || { codeforces: [], leetcode: [] };
}

export function ensureProblemMeta(p) {
  if (!p.meta || typeof p.meta !== 'object') p.meta = {};
  if (!Array.isArray(p.meta.versions)) p.meta.versions = [];
  if (!p.meta.revision) p.meta.revision = { stage: 0, nextDue: null, intervalDays: REVISION_INTERVALS[0] };
  if (!Array.isArray(p.meta.linkedNoteIds)) p.meta.linkedNoteIds = [];
  if (!Array.isArray(p.meta.linkedContestIds)) p.meta.linkedContestIds = [];
}

export function ensureNoteMeta(n) {
  if (!n.meta || typeof n.meta !== 'object') n.meta = {};
  if (!Array.isArray(n.meta.linkedProblemIds)) n.meta.linkedProblemIds = [];
}

export function getAllTags(state, STANDARD_TAGS) {
  const set = new Set([...STANDARD_TAGS, ...(state.prefs?.customTags || [])]);
  state.problems.forEach((p) => (p.tags || []).forEach((t) => set.add(t)));
  return [...set].sort();
}

export function resolveTagAlias(tag, prefs) {
  const key = (tag || '').toLowerCase().trim();
  const aliases = prefs?.tagAliases || {};
  return aliases[key] || tag;
}

export function normalizeProblemKey(p) {
  const url = (p.url || '').toLowerCase().replace(/\/$/, '');
  if (url) return url;
  return `${(p.platform || '').toLowerCase()}::${(p.name || '').toLowerCase().trim()}`;
}

export function findDuplicateGroups(problems) {
  const map = new Map();
  problems.forEach((p) => {
    const k = normalizeProblemKey(p);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(p);
  });
  return [...map.values()].filter((g) => g.length > 1);
}

export function pushProblemVersion(p) {
  ensureProblemMeta(p);
  const snap = {
    code: p.code || '',
    errors: p.errors || '',
    concept: p.concept || '',
    savedAt: new Date().toISOString(),
  };
  const last = p.meta.versions[0];
  if (last && last.code === snap.code && last.errors === snap.errors && last.concept === snap.concept) return;
  p.meta.versions.unshift(snap);
  if (p.meta.versions.length > 20) p.meta.versions.length = 20;
}

export function getRevisionDueProblems(state) {
  const now = Date.now();
  return state.problems.filter((p) => {
    if (p.classification !== 'confident') return false;
    ensureProblemMeta(p);
    const due = p.meta.revision?.nextDue;
    if (!due) return true;
    return new Date(due).getTime() <= now;
  });
}

export function scheduleRevisionSuccess(p) {
  ensureProblemMeta(p);
  const stage = Math.min((p.meta.revision.stage || 0) + 1, REVISION_INTERVALS.length - 1);
  p.meta.revision.stage = stage;
  p.meta.revision.intervalDays = REVISION_INTERVALS[stage];
  const next = new Date();
  next.setDate(next.getDate() + p.meta.revision.intervalDays);
  p.meta.revision.nextDue = next.toISOString();
}

export function scheduleRevisionFail(p) {
  ensureProblemMeta(p);
  p.meta.revision.stage = 0;
  p.meta.revision.intervalDays = REVISION_INTERVALS[0];
  p.meta.revision.nextDue = new Date(Date.now() + 3 * 86400000).toISOString();
  p.classification = 'resolve';
}

export function getPracticeRecommendations(state, limit = 5) {
  const stats = {};
  state.problems.forEach((p) => {
    (p.tags || []).forEach((t) => {
      if (!stats[t]) stats[t] = { total: 0, weak: 0 };
      stats[t].total++;
      if (p.classification === 'resolve' || !p.classification) stats[t].weak++;
    });
  });
  const weakTags = Object.entries(stats)
    .filter(([t]) => t !== 'Uncategorized')
    .sort((a, b) => b[1].weak / Math.max(1, b[1].total) - a[1].weak / Math.max(1, a[1].total))
    .slice(0, 3)
    .map(([t]) => t);

  const candidates = state.problems.filter((p) => {
    if (p.classification === 'confident') return false;
    return (p.tags || []).some((t) => weakTags.includes(t));
  });
  candidates.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  return candidates.slice(0, limit);
}

export function countActivityToday(state, localDateKeyFromValue) {
  const today = localDateKeyFromValue(new Date());
  let n = 0;
  state.problems.forEach((p) => {
    if (localDateKeyFromValue(p.date) === today) n++;
  });
  return n;
}

export function countActivityThisWeek(state, localDateStr, addLocalDays, localDateFromParts) {
  const today = localDateFromParts(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const key = localDateStr(addLocalDays(today, -i));
    state.problems.forEach((p) => {
      /* caller passes actMap preferred */
    });
  }
  return n;
}

export function buildGoalsProgress(state, actMap, localDateKeyFromValue, localDateStr, addLocalDays, localDateFromParts) {
  const g = state.prefs?.goals || defaultPrefs().goals;
  const today = localDateKeyFromValue(new Date());
  let todayCount = 0;
  state.problems.forEach((p) => {
    if (localDateKeyFromValue(p.date) === today) todayCount++;
  });
  const todayLocal = localDateFromParts(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  let weekCount = 0;
  for (let i = 0; i < 7; i++) {
    const key = localDateStr(addLocalDays(todayLocal, -i));
    weekCount += actMap[key] || 0;
  }
  const weekContests = (state.contestPerformances || []).filter((c) => {
    const d = localDateKeyFromValue(c.contestDate || c.date);
    for (let i = 0; i < 7; i++) {
      if (localDateStr(addLocalDays(todayLocal, -i)) === d) return true;
    }
    return false;
  }).length;
  return {
    todayCount,
    dailyGoal: g.dailyProblems || 1,
    weekCount,
    weeklyGoal: g.weeklyProblems || 7,
    weekContests,
    weeklyContestGoal: g.weeklyContests || 1,
  };
}

export function generateIcs(state) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CP Vault//EN', 'CALSCALE:GREGORIAN'];
  const stamp = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  (state.contests || []).forEach((c) => {
    const start = new Date(c.date);
    const end = new Date(start.getTime() + (c.duration || 120) * 60000);
    const uid = `cpvault-${c.id}@cpvault`;
    lines.push('BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`, `SUMMARY:${(c.name || '').replace(/[,;]/g, ' ')}`, `DESCRIPTION:${c.platform || ''} contest`, `URL:${c.url || ''}`, 'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadText(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function renderGoalsCard(progress) {
  const pct = (a, b) => Math.min(100, Math.round((a / Math.max(1, b)) * 100));
  return `<div class="card" style="margin-bottom:14px">
    <div class="section-head">Goals</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px">
      <div><div style="font-size:11px;color:var(--text3)">Today</div><div style="font-size:18px;font-weight:700;color:var(--accent)">${progress.todayCount}/${progress.dailyGoal}</div>
        <div style="height:4px;background:var(--bg4);border-radius:2px;margin-top:6px"><div style="height:100%;width:${pct(progress.todayCount, progress.dailyGoal)}%;background:var(--accent);border-radius:2px"></div></div></div>
      <div><div style="font-size:11px;color:var(--text3)">This week</div><div style="font-size:18px;font-weight:700;color:var(--green)">${progress.weekCount}/${progress.weeklyGoal}</div>
        <div style="height:4px;background:var(--bg4);border-radius:2px;margin-top:6px"><div style="height:100%;width:${pct(progress.weekCount, progress.weeklyGoal)}%;background:var(--green);border-radius:2px"></div></div></div>
      <div><div style="font-size:11px;color:var(--text3)">Contests (week)</div><div style="font-size:18px;font-weight:700;color:var(--amber)">${progress.weekContests}/${progress.weeklyContestGoal}</div>
        <div style="height:4px;background:var(--bg4);border-radius:2px;margin-top:6px"><div style="height:100%;width:${pct(progress.weekContests, progress.weeklyContestGoal)}%;background:var(--amber);border-radius:2px"></div></div></div>
    </div>
    <button type="button" class="btn btn-ghost btn-sm" style="margin-top:10px" data-open-settings>Edit goals & sync</button>
  </div>`;
}

export function renderRecommendations(recs, esc) {
  if (!recs.length) return '';
  return `<div class="card" style="margin-bottom:14px"><div class="section-head">Practice picks</div>
    ${recs.map((p) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
      <div><div style="font-weight:600;font-size:13px">${esc(p.name)}</div><div style="font-size:11px;color:var(--text3)">${esc(p.platform)} · ${(p.tags || []).slice(0, 2).join(', ')}</div></div>
      <button type="button" class="btn btn-ghost btn-sm" data-view-problem="${esc(String(p.id))}">Open</button>
    </div>`).join('')}
  </div>`;
}

export function renderComparePeriods(state, localDateKeyFromValue, localDateStr, addLocalDays, localDateFromParts) {
  const todayLocal = localDateFromParts(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const countRange = (startOff, endOff) => {
    let n = 0;
    for (let i = startOff; i <= endOff; i++) {
      const key = localDateStr(addLocalDays(todayLocal, -i));
      state.problems.forEach((p) => {
        if (localDateKeyFromValue(p.date) === key) n++;
      });
    }
    return n;
  };
  const thisWeek = countRange(0, 6);
  const lastWeek = countRange(7, 13);
  const thisMonth = countRange(0, 29);
  const lastMonth = countRange(30, 59);
  const delta = (a, b) => (b === 0 ? (a > 0 ? '+100%' : '0%') : `${Math.round(((a - b) / b) * 100)}%`);
  return `<div class="card" style="margin-bottom:14px"><div class="section-head">Compare periods</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px">
      <div>This week: <strong>${thisWeek}</strong> · Last week: ${lastWeek} <span style="color:var(--accent)">(${delta(thisWeek, lastWeek)})</span></div>
      <div>Last 30d: <strong>${thisMonth}</strong> · Prior 30d: ${lastMonth} <span style="color:var(--accent)">(${delta(thisMonth, lastMonth)})</span></div>
    </div></div>`;
}

export function renderRatingProgression(state) {
  const buckets = {};
  state.problems.forEach((p) => {
    const r = parseInt(p.rating, 10);
    if (!r || r < 800 || r > 3500) return;
    const bin = Math.floor(r / 200) * 200;
    buckets[bin] = (buckets[bin] || 0) + 1;
  });
  const keys = Object.keys(buckets).map(Number).sort((a, b) => a - b);
  if (!keys.length) return '<div style="color:var(--text3);font-size:13px">Add rated problems to see progression.</div>';
  const max = Math.max(...Object.values(buckets));
  return keys.map((k) => {
    const w = Math.round((buckets[k] / max) * 100);
    return `<div class="chart-row"><div class="chart-label">${k}</div><div class="chart-bar-wrap"><div class="chart-bar" style="width:${w}%">${buckets[k]}</div></div></div>`;
  }).join('');
}

export function renderRatingHistoryChart(prefs) {
  const cf = prefs?.ratingHistory?.codeforces || [];
  const lc = prefs?.ratingHistory?.leetcode || [];
  const series = cf.length ? cf : lc;
  if (!series.length) return '<div style="color:var(--text3);font-size:13px;padding:12px">Click “Refresh ratings” in Settings to load history.</div>';
  const max = Math.max(...series.map((p) => p.rating));
  const min = Math.min(...series.map((p) => p.rating));
  const range = Math.max(1, max - min);
  const pts = series.slice(-30).map((p, i, arr) => {
    const x = (i / Math.max(1, arr.length - 1)) * 100;
    const y = 100 - ((p.rating - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');
  return `<svg viewBox="0 0 100 40" style="width:100%;height:80px;background:var(--bg3);border-radius:8px"><polyline fill="none" stroke="var(--accent)" stroke-width="1.5" points="${pts}"/></svg>
    <div style="font-size:11px;color:var(--text3);margin-top:6px">Latest: ${series[series.length - 1].rating} (${series[series.length - 1].date?.slice(0, 10) || ''})</div>`;
}

export function renderContestCalendar(state, esc, getContestEnd) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const first = new Date(y, m, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const contestsByDay = {};
  (state.contests || []).forEach((c) => {
    const d = new Date(c.date);
    if (d.getMonth() !== m || d.getFullYear() !== y) return;
    const day = d.getDate();
    if (!contestsByDay[day]) contestsByDay[day] = [];
    contestsByDay[day].push(c);
  });
  let html = `<div class="card"><div class="section-head">${now.toLocaleString('default', { month: 'long', year: 'numeric' })}</div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;font-size:10px;text-align:center;color:var(--text3)">
      ${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<div>${d}</div>`).join('')}
    </div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:4px">`;
  for (let i = 0; i < startPad; i++) html += '<div></div>';
  for (let day = 1; day <= daysInMonth; day++) {
    const list = contestsByDay[day] || [];
    const isToday = day === now.getDate();
    html += `<div style="min-height:52px;padding:4px;border-radius:6px;background:${isToday ? 'rgba(91,141,238,0.12)' : 'var(--bg3)'};border:1px solid var(--border)">
      <div style="font-size:10px;font-weight:700;color:${isToday ? 'var(--accent)' : 'var(--text2)'}">${day}</div>
      ${list.slice(0, 2).map((c) => `<div style="font-size:9px;margin-top:2px;color:var(--amber);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(c.name)}">${esc(c.platform?.slice(0, 2) || '')} ${esc(c.name?.slice(0, 12) || '')}</div>`).join('')}
      ${list.length > 2 ? `<div style="font-size:9px;color:var(--text3)">+${list.length - 2}</div>` : ''}
    </div>`;
  }
  html += '</div></div>';
  return html;
}

export async function fetchRatingHistory(state, handles) {
  const hist = state.prefs.ratingHistory || { codeforces: [], leetcode: [] };
  const cf = handles.codeforces?.trim();
  if (cf) {
    try {
      const res = await fetch(`https://codeforces.com/api/user.info?handles=${encodeURIComponent(cf)}`);
      const data = await res.json();
      if (data.status === 'OK' && data.result[0]) {
        const u = data.result[0];
        hist.codeforces.push({ date: new Date().toISOString(), rating: u.rating || 0, rank: u.rank });
        if (hist.codeforces.length > 60) hist.codeforces = hist.codeforces.slice(-60);
      }
    } catch (e) {
      console.warn('CF rating', e);
    }
  }
  const lc = handles.leetcode?.trim();
  if (lc) {
    try {
      const res = await fetch(`https://alfa-leetcode-api.onrender.com/${encodeURIComponent(lc)}`);
      if (res.ok) {
        const u = await res.json();
        const r = u.ranking || u.contestRanking || 0;
        hist.leetcode.push({ date: new Date().toISOString(), rating: r });
        if (hist.leetcode.length > 60) hist.leetcode = hist.leetcode.slice(-60);
      }
    } catch (e) {
      console.warn('LC rating', e);
    }
  }
  state.prefs.ratingHistory = hist;
}

export async function runBackgroundSync(ctx) {
  const { state, syncCF, syncLC, syncAT, showToast, saveStateNow } = ctx;
  const sync = state.prefs?.sync;
  if (!sync?.enabled) return;
  const hours = sync.intervalHours || 24;
  const last = sync.lastSyncAt ? new Date(sync.lastSyncAt).getTime() : 0;
  if (Date.now() - last < hours * 3600000) return;
  const platforms = sync.platforms || ['cf', 'lc', 'at'];
  showToast?.('Background sync started…');
  try {
    if (platforms.includes('cf') && document.getElementById('cf-handle')?.value?.trim()) await syncCF?.();
    if (platforms.includes('lc') && document.getElementById('lc-handle')?.value?.trim()) await syncLC?.();
    if (platforms.includes('at') && document.getElementById('at-handle')?.value?.trim()) await syncAT?.();
    if (platforms.includes('cc') && ctx.syncCC) await ctx.syncCC();
    if (platforms.includes('hr') && ctx.syncHR) await ctx.syncHR();
    state.prefs.sync.lastSyncAt = new Date().toISOString();
    await saveStateNow?.();
    showToast?.('Background sync finished');
  } catch (e) {
    console.error(e);
    showToast?.('Background sync failed');
  }
}

export function initFeaturesV2(ctx) {
  const {
    state,
    esc,
    STANDARD_TAGS,
    UNCATEGORIZED_TAG,
    getActivityMap,
    localDateKeyFromValue,
    localDateStr,
    addLocalDays,
    localDateFromParts,
    saveState,
    saveStateNow,
    showToast,
    openModal,
    closeModal,
    nav,
    renderPage,
    syncCF,
    syncLC,
    syncAT,
    fetchAllContests,
    getContestEnd,
    buildContestAnalytics,
    showImportPreview,
  } = ctx;

  ensurePrefs(state);
  state.problems.forEach(ensureProblemMeta);
  state.notes.forEach(ensureNoteMeta);
  state.selectedProblemIds = state.selectedProblemIds || new Set();

  window.HEATMAP_WEEKS = 52;
  window.getAllTags = () => getAllTags(state, STANDARD_TAGS);
  window.CPFeatures = ctx;

  // Global search overlay
  if (!document.getElementById('global-search-overlay')) {
    const ov = document.createElement('div');
    ov.id = 'global-search-overlay';
    ov.className = 'modal-overlay hidden';
    ov.innerHTML = `<div class="modal" style="max-width:520px">
      <div class="modal-header"><div class="modal-title">Search</div><button type="button" class="modal-close" data-close-search>×</button></div>
      <input class="form-input" id="global-search-input" placeholder="Problems, notes, contests, tags…" style="margin-bottom:12px">
      <div id="global-search-results" style="max-height:320px;overflow:auto"></div>
      <div style="font-size:11px;color:var(--text3);margin-top:8px">⌘K / Ctrl+K · Esc to close</div>
    </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', (e) => {
      if (e.target === ov || e.target.closest('[data-close-search]')) ov.classList.add('hidden');
    });
    document.getElementById('global-search-input')?.addEventListener('input', (e) => {
      runGlobalSearch(e.target.value, state, esc, nav, ov);
    });
  }

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      openGlobalSearch();
    }
    if (e.key === 'Escape') document.getElementById('global-search-overlay')?.classList.add('hidden');
    if (e.key === 'n' && !e.metaKey && !e.ctrlKey && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
      if (typeof window.openAddProblem === 'function') window.openAddProblem();
    }
    if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
      e.preventDefault();
      openGlobalSearch();
    }
  });

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-open-settings]')) openSettingsModal(ctx);
    if (e.target.closest('[data-export-ical]')) {
      downloadText('cpvault-contests.ics', generateIcs(state), 'text/calendar');
      showToast?.('Calendar file downloaded — import into Google Calendar');
    }
    if (e.target.closest('[data-merge-dup]')) {
      const key = e.target.getAttribute('data-merge-dup');
      mergeDuplicates(state, key, saveStateNow, showToast, renderPage);
    }
  });

  setInterval(() => runBackgroundSync({ ...ctx, syncCF, syncLC, syncAT, syncCC: ctx.syncCC, syncHR: ctx.syncHR }), 15 * 60 * 1000);
  setTimeout(() => runBackgroundSync({ ...ctx, syncCF, syncLC, syncAT, syncCC: ctx.syncCC, syncHR: ctx.syncHR }), 8000);

  window.renderV2DashboardExtras = function (actMap) {
    const progress = buildGoalsProgress(state, actMap, localDateKeyFromValue, localDateStr, addLocalDays, localDateFromParts);
    const recs = getPracticeRecommendations(state);
    return renderGoalsCard(progress) + renderRecommendations(recs, esc) + renderComparePeriods(state, localDateKeyFromValue, localDateStr, addLocalDays, localDateFromParts);
  };

  window.renderV2AnalysisExtras = function () {
    return `<div class="card" style="margin-top:14px"><div class="section-head">Rating progression (by bucket)</div>${renderRatingProgression(state)}</div>
      <div class="card" style="margin-top:14px"><div class="section-head">Rating history</div>${renderRatingHistoryChart(state.prefs)}</div>`;
  };

  window.renderUpsolvePage = function () {
    const el = document.getElementById('upsolve-page-root');
    if (!el || typeof window.renderUpsolve !== 'function') return;
    window.renderUpsolve();
    el.innerHTML = document.getElementById('upsolve-list')?.outerHTML ? '' : '';
    const list = document.getElementById('upsolve-list');
    if (list && list.parentElement?.id !== 'upsolve-page-root') {
      el.appendChild(list);
    }
  };

  window.renderContestCalendarPanel = function () {
    const el = document.getElementById('contest-calendar-root');
    if (el) el.innerHTML = renderContestCalendar(state, esc, getContestEnd);
  };

  window.pushProblemVersion = (p) => pushProblemVersion(p);
  window.getRevisionDueProblems = () => getRevisionDueProblems(state);
  window.scheduleRevisionSuccess = scheduleRevisionSuccess;
  window.scheduleRevisionFail = scheduleRevisionFail;
  window.findDuplicateGroups = () => findDuplicateGroups(state.problems);
  window.openSettingsModal = () => openSettingsModal(ctx);
}

function openGlobalSearch() {
  const ov = document.getElementById('global-search-overlay');
  if (!ov) return;
  ov.classList.remove('hidden');
  const inp = document.getElementById('global-search-input');
  if (inp) {
    inp.value = '';
    inp.focus();
    inp.dispatchEvent(new Event('input'));
  }
}

function runGlobalSearch(q, state, esc, nav, ov) {
  const el = document.getElementById('global-search-results');
  if (!el) return;
  const term = (q || '').toLowerCase().trim();
  if (!term) {
    el.innerHTML = '<div style="color:var(--text3);font-size:13px">Type to search…</div>';
    return;
  }
  const hits = [];
  state.problems.forEach((p) => {
    if (`${p.name} ${p.platform} ${(p.tags || []).join(' ')}`.toLowerCase().includes(term))
      hits.push({ type: 'Problem', label: p.name, action: () => { window.viewProblem?.(p.id); ov.classList.add('hidden'); } });
  });
  state.notes.forEach((n) => {
    if (`${n.title} ${n.topic} ${n.content}`.toLowerCase().includes(term))
      hits.push({ type: 'Note', label: n.title, action: () => { nav('notes'); ov.classList.add('hidden'); } });
  });
  state.contests.forEach((c) => {
    if (`${c.name} ${c.platform}`.toLowerCase().includes(term))
      hits.push({ type: 'Contest', label: c.name, action: () => { nav('contests'); ov.classList.add('hidden'); } });
  });
  el.innerHTML = hits.slice(0, 20).map((h, i) =>
    `<button type="button" class="btn btn-ghost" style="width:100%;justify-content:flex-start;margin-bottom:4px" data-search-idx="${i}">
      <span class="tag tag-purple" style="margin-right:8px;font-size:10px">${h.type}</span>${esc(h.label)}
    </button>`
  ).join('') || '<div style="color:var(--text3)">No results</div>';
  el.querySelectorAll('[data-search-idx]').forEach((btn) => {
    btn.addEventListener('click', () => hits[parseInt(btn.getAttribute('data-search-idx'), 10)].action());
  });
}

function mergeDuplicates(state, key, saveStateNow, showToast, renderPage) {
  const groups = findDuplicateGroups(state.problems);
  const group = groups.find((g) => normalizeProblemKey(g[0]) === key);
  if (!group || group.length < 2) return;
  const keep = group[0];
  for (let i = 1; i < group.length; i++) {
    const dup = group[i];
    keep.attempts = Math.max(keep.attempts || 0, dup.attempts || 0);
    if ((dup.code || '').length > (keep.code || '').length) {
      keep.code = dup.code;
      keep.errors = dup.errors;
      keep.concept = dup.concept;
    }
    state.problems = state.problems.filter((p) => p.id !== dup.id);
  }
  saveStateNow?.().then(() => {
    showToast?.('Duplicates merged');
    renderPage?.(state.currentPage);
  });
}

function openSettingsModal(ctx) {
  const { state, saveStateNow, showToast, fetchRatingHistory } = ctx;
  ensurePrefs(state);
  let modal = document.getElementById('modal-settings');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-settings';
    modal.className = 'modal-overlay hidden';
    document.body.appendChild(modal);
  }
  const g = state.prefs.goals;
  const s = state.prefs.sync;
  modal.innerHTML = `<div class="modal" style="max-width:480px">
    <div class="modal-header"><div class="modal-title">Settings</div><button type="button" class="modal-close" onclick="document.getElementById('modal-settings').classList.add('hidden')">×</button></div>
    <div class="section-head">Daily / weekly goals</div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Problems / day</label><input class="form-input" id="set-daily" type="number" min="0" value="${g.dailyProblems}"></div>
      <div class="form-group"><label class="form-label">Problems / week</label><input class="form-input" id="set-weekly" type="number" min="0" value="${g.weeklyProblems}"></div>
    </div>
    <div class="form-group"><label class="form-label">Contests / week</label><input class="form-input" id="set-contests" type="number" min="0" value="${g.weeklyContests}"></div>
    <div class="section-head" style="margin-top:14px">Background sync</div>
    <label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:8px">
      <input type="checkbox" id="set-sync-en" ${s.enabled ? 'checked' : ''}> Enable auto-sync
    </label>
    <div class="form-group"><label class="form-label">Interval (hours)</label><input class="form-input" id="set-sync-h" type="number" min="6" value="${s.intervalHours || 24}"></div>
    <div class="section-head" style="margin-top:14px">Custom tags (comma-separated)</div>
    <input class="form-input" id="set-custom-tags" value="${(state.prefs.customTags || []).join(', ')}">
    <div class="section-head" style="margin-top:14px">Email reminders</div>
    <label style="display:flex;align-items:center;gap:8px;font-size:13px"><input type="checkbox" id="set-email-en" ${state.prefs.emailEnabled ? 'checked' : ''}> Enable email (requires SMTP on server)</label>
    <input class="form-input" id="set-email" placeholder="Email override (optional)" value="${state.prefs.emailAddress || ''}" style="margin-top:8px">
  <button type="button" class="btn btn-ghost btn-sm" id="set-test-email" style="margin-top:8px">Send test email</button>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
      <button type="button" class="btn btn-ghost" onclick="document.getElementById('modal-settings').classList.add('hidden')">Cancel</button>
      <button type="button" class="btn btn-primary" id="set-save">Save</button>
    </div>
  </div>`;
  modal.classList.remove('hidden');
  document.getElementById('set-save')?.addEventListener('click', async () => {
    state.prefs.goals.dailyProblems = parseInt(document.getElementById('set-daily').value, 10) || 1;
    state.prefs.goals.weeklyProblems = parseInt(document.getElementById('set-weekly').value, 10) || 7;
    state.prefs.goals.weeklyContests = parseInt(document.getElementById('set-contests').value, 10) || 1;
    state.prefs.sync.enabled = document.getElementById('set-sync-en').checked;
    state.prefs.sync.intervalHours = parseInt(document.getElementById('set-sync-h').value, 10) || 24;
    state.prefs.customTags = (document.getElementById('set-custom-tags').value || '').split(',').map((t) => t.trim()).filter(Boolean);
    state.prefs.emailEnabled = document.getElementById('set-email-en').checked;
    state.prefs.emailAddress = document.getElementById('set-email').value.trim();
    await saveStateNow?.();
    showToast?.('Settings saved');
    modal.classList.add('hidden');
    if (state.currentPage === 'dashboard') window.renderDashboard?.();
  }, { once: true });
  document.getElementById('set-test-email')?.addEventListener('click', async () => {
    try {
      await window.api?.request?.('/notifications/contest-reminders', { method: 'POST' });
      showToast?.('Email request sent (if SMTP configured)');
    } catch (e) {
      showToast?.(e.message || 'Email failed');
    }
  }, { once: true });
  document.getElementById('set-refresh-ratings')?.addEventListener('click', async () => {
    await fetchRatingHistory(state, {
      codeforces: document.getElementById('cf-handle')?.value,
      leetcode: document.getElementById('lc-handle')?.value,
    });
    await saveStateNow?.();
    showToast?.('Ratings updated');
  }, { once: true });
}
