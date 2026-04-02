-- Add first_name and last_name columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name  text;

-- Populate from existing display_name (split on first space)
UPDATE public.profiles
SET
  first_name = split_part(display_name, ' ', 1),
  last_name  = NULLIF(
    trim(substring(display_name FROM position(' ' IN display_name) + 1)),
    ''
  )
WHERE first_name IS NULL;
