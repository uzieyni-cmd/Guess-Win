-- טבלת cache לרשימת ליגות מ-API-Football
-- מתעדכנת פעם בשבוע דרך Vercel Cron
CREATE TABLE IF NOT EXISTS leagues_cache (
  id         INTEGER PRIMARY KEY DEFAULT 1,
  leagues    JSONB       NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);
