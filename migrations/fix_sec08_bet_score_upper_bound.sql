-- SEC-08: הוספת גבול עליון לניחושי ניקוד
-- לפני: check (predicted_home >= 0) בלבד — ניתן להכניס predicted_home: 999
-- אחרי: גבול עליון של 30 (מספיק לכל תוצאה אמיתית בכדורגל)

alter table public.bets
  drop constraint if exists bets_predicted_home_check,
  drop constraint if exists bets_predicted_away_check;

alter table public.bets
  add constraint bets_predicted_home_check check (predicted_home >= 0 and predicted_home <= 30),
  add constraint bets_predicted_away_check check (predicted_away >= 0 and predicted_away <= 30);
