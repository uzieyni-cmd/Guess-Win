-- Enable Supabase Realtime on the matches table
-- Run this in Supabase Dashboard → SQL Editor

ALTER PUBLICATION supabase_realtime ADD TABLE matches;
