
CREATE TABLE IF NOT EXISTS public.matches_cache (
  id text PRIMARY KEY,
  sport_key text NOT NULL,
  league text NOT NULL,
  home text NOT NULL,
  away text NOT NULL,
  commence_time timestamptz NOT NULL,
  bookmaker_count int NOT NULL DEFAULT 0,
  best_home numeric NOT NULL DEFAULT 0,
  best_draw numeric NOT NULL DEFAULT 0,
  best_away numeric NOT NULL DEFAULT 0,
  bet365_home numeric NOT NULL DEFAULT 0,
  bet365_draw numeric NOT NULL DEFAULT 0,
  bet365_away numeric NOT NULL DEFAULT 0,
  market_margin numeric NOT NULL DEFAULT 0,
  favorite_prob numeric NOT NULL DEFAULT 0,
  match_type text NOT NULL DEFAULT 'balanced',
  is_arb boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_matches_cache_commence ON public.matches_cache (commence_time);
CREATE INDEX IF NOT EXISTS idx_matches_cache_league ON public.matches_cache (league);
CREATE INDEX IF NOT EXISTS idx_matches_cache_updated ON public.matches_cache (updated_at);

ALTER TABLE public.matches_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read matches cache"
  ON public.matches_cache FOR SELECT
  USING (true);
