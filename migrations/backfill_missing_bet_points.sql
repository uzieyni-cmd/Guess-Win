-- Backfill bet points that are NULL despite the match being finished.
-- Covers matches set manually (admin), via refreshMatchResult, or syncFixtures
-- where saveMatchPoints never ran.
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
