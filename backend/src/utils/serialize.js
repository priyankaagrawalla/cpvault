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
    date: row.solved_date ? new Date(row.solved_date).toISOString() : new Date(row.created_at).toISOString(),
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
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    meta,
  };
}

export function rowToContest(row) {
  return {
    id: row.id,
    externalId: row.external_id,
    name: row.name,
    platform: row.platform,
    date: new Date(row.contest_date).toISOString(),
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
