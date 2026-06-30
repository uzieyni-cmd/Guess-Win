-- Per-tournament toggle for the unique-exact-predictor bonus (+5).
-- Default true → existing tournaments keep current behavior; set false to disable.
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS unique_bonus_enabled BOOLEAN NOT NULL DEFAULT TRUE;
