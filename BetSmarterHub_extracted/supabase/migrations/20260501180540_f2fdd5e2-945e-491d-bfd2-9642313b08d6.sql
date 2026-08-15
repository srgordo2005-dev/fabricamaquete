CREATE TABLE IF NOT EXISTS public.match_dossier_cache (
  match_id text PRIMARY KEY,
  dossier_text text NOT NULL,
  dossier_data jsonb NOT NULL,
  commence_time timestamptz NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.match_dossier_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read dossier cache"
ON public.match_dossier_cache FOR SELECT
USING (true);

CREATE INDEX IF NOT EXISTS idx_dossier_commence ON public.match_dossier_cache(commence_time);