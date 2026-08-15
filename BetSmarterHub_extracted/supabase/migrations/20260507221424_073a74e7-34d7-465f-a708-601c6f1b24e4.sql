ALTER TABLE public.matches_cache
  ADD COLUMN IF NOT EXISTS home_logo text,
  ADD COLUMN IF NOT EXISTS away_logo text,
  ADD COLUMN IF NOT EXISTS league_logo text;