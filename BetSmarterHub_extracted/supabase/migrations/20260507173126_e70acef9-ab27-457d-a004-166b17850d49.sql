CREATE TABLE IF NOT EXISTS public.news_cache (
  query TEXT PRIMARY KEY,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.news_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read news cache" ON public.news_cache FOR SELECT USING (true);