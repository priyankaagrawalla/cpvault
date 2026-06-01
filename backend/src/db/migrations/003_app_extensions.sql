-- Extended app data: goals, custom tags, problem versions, sync prefs, etc.

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS prefs JSONB NOT NULL DEFAULT '{}';

ALTER TABLE problems
  ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}';

ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}';

ALTER TABLE platform_handles
  ADD COLUMN IF NOT EXISTS codechef_handle VARCHAR(100);

ALTER TABLE platform_handles
  ADD COLUMN IF NOT EXISTS hackerrank_handle VARCHAR(100);
