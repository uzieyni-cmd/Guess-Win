-- Add hidden flag to matches — admin can hide matches from participants
-- (e.g. show only matches from a certain stage onward).
-- Hidden matches are excluded from participant match lists and cannot be bet on.
ALTER TABLE matches ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial index: participant queries filter on hidden = false
CREATE INDEX IF NOT EXISTS matches_tournament_visible_idx
  ON matches (tournament_id, match_start_time)
  WHERE hidden = FALSE;
