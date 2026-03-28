-- Speeds up the primary match loading query:
-- tournament_id + match_start_time (used in every query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_tournament_start
  ON matches (tournament_id, match_start_time ASC);

-- Speeds up the hasPast count query (status filter)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_tournament_status_start
  ON matches (tournament_id, status, match_start_time ASC);
