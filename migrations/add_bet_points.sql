-- Add points + result columns to bets table
ALTER TABLE public.bets ADD COLUMN IF NOT EXISTS points integer;
ALTER TABLE public.bets ADD COLUMN IF NOT EXISTS result text;
ALTER TABLE public.bets ADD CONSTRAINT IF NOT EXISTS bets_result_check
  CHECK (result IN ('exact', 'outcome', 'miss'));

-- Backfill points for all existing finished matches
UPDATE public.bets
SET
  points = CASE
    WHEN bets.predicted_home = m.actual_home_score
     AND bets.predicted_away = m.actual_away_score
    THEN 10
    WHEN (
      CASE WHEN bets.predicted_home > bets.predicted_away THEN 'home'
           WHEN bets.predicted_away > bets.predicted_home THEN 'away'
           ELSE 'draw' END
    ) = (
      CASE WHEN m.actual_home_score > m.actual_away_score THEN 'home'
           WHEN m.actual_away_score > m.actual_home_score THEN 'away'
           ELSE 'draw' END
    )
    THEN 5
    ELSE 0
  END,
  result = CASE
    WHEN bets.predicted_home = m.actual_home_score
     AND bets.predicted_away = m.actual_away_score
    THEN 'exact'
    WHEN (
      CASE WHEN bets.predicted_home > bets.predicted_away THEN 'home'
           WHEN bets.predicted_away > bets.predicted_home THEN 'away'
           ELSE 'draw' END
    ) = (
      CASE WHEN m.actual_home_score > m.actual_away_score THEN 'home'
           WHEN m.actual_away_score > m.actual_home_score THEN 'away'
           ELSE 'draw' END
    )
    THEN 'outcome'
    ELSE 'miss'
  END
FROM public.matches m
WHERE bets.match_id = m.id
  AND m.status = 'finished'
  AND m.actual_home_score IS NOT NULL
  AND m.actual_away_score IS NOT NULL
  AND bets.points IS NULL;
