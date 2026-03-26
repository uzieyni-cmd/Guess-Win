-- Add elapsed_minutes column to matches table for live match tracking
ALTER TABLE matches ADD COLUMN IF NOT EXISTS elapsed_minutes INTEGER DEFAULT NULL;
