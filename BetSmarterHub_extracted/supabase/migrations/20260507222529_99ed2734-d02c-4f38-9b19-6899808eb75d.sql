CREATE TABLE IF NOT EXISTS public.match_context_cache (
  cache_key text PRIMARY KEY,
  home text NOT NULL,
  away text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'ok',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.match_context_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read match context cache"
  ON public.match_context_cache
  FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_match_context_cache_updated_at
  ON public.match_context_cache (updated_at DESC);