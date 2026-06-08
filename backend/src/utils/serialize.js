const IST_OFFSET = '+05:30';
const istFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/** Serialize timestamps as IST wall time so daily goals stay on the IST calendar day. */
export function toISTIso(value) {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  const parts = {};
  istFormatter.formatToParts(d).forEach((p) => {
    if (p.type !== 'literal') parts[p.type] = p.value;
  });
  const pad = (n) => String(n).padStart(2, '0');
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}${IST_OFFSET}`;
}

export function rowToProblem(row) {
  const meta = row.meta && typeof row.meta === 'object' ? row.meta : {};
  return {
    id: row.client_id || row.id,
    dbId: row.id,
    name: row.name,
    platform: row.platform,
    url: row.url || '',
    rating: row.rating || '',
    tags: row.tags || [],
    attempts: row.attempts || 0,
    code: row.code || '',
    errors: row.errors || '',
    concept: row.concept || '',
    classification: row.classification,
    date: row.solved_date ? toISTIso(row.solved_date) : toISTIso(row.created_at),
    imported: row.imported,
    meta,
  };
}

export function rowToNote(row) {
  const meta = row.meta && typeof row.meta === 'object' ? row.meta : {};
  return {
    id: row.client_id || row.id,
    dbId: row.id,
    title: row.title,
    topic: row.topic,
    content: row.content,
    createdAt: toISTIso(row.created_at),
    updatedAt: toISTIso(row.updated_at),
    meta,
  };
}

export function rowToContest(row) {
  return {
    id: row.id,
    externalId: row.external_id,
    name: row.name,
    platform: row.platform,
    date: toISTIso(row.contest_date),
    duration: row.duration_minutes,
    url: row.url || '',
    source: row.source,
    reminders: row.reminders || [],
    firedReminders: row.fired_reminders || [],
    upsolveAdded: row.upsolve_added,
  };
}

export function rowToUpsolve(row) {
  return {
    id: row.client_id || row.id,
    dbId: row.id,
    name: row.name,
    platform: row.platform,
    contest: row.contest_name,
    contestId: row.contest_id,
    tags: row.tags || [],
    status: row.status,
    url: row.url || '',
    isContestPlaceholder: row.is_contest_placeholder,
  };
}
