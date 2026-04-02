-- Add odds columns to matches table
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS odds_home  numeric(6,2),
  ADD COLUMN IF NOT EXISTS odds_draw  numeric(6,2),
  ADD COLUMN IF NOT EXISTS odds_away  numeric(6,2),
  ADD COLUMN IF NOT EXISTS odds_updated_at timestamptz;
