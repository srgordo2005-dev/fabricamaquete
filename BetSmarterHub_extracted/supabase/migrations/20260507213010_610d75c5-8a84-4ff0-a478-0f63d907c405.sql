
ALTER TABLE public.admin_news
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS sources_meta jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS team_ids text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_processed boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS admin_news_content_hash_uidx ON public.admin_news(content_hash) WHERE content_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS admin_news_status_idx ON public.admin_news(status, pub_date DESC);

-- Allow admins to read pending items (existing ALL policy already covers it, but the public-read SELECT excludes status filter — keep public read scoped to approved+published)
DROP POLICY IF EXISTS "Anyone reads published news" ON public.admin_news;
CREATE POLICY "Anyone reads approved published news"
ON public.admin_news FOR SELECT
USING (published = true AND status = 'approved');
