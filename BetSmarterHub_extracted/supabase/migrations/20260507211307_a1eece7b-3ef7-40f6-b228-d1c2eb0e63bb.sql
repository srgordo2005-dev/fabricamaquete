
CREATE TABLE public.admin_news (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  body TEXT NOT NULL,
  thumb TEXT,
  source TEXT,
  category TEXT NOT NULL DEFAULT 'todas',
  link TEXT,
  published BOOLEAN NOT NULL DEFAULT true,
  pub_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_news ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads published news"
ON public.admin_news FOR SELECT
USING (published = true);

CREATE POLICY "Admins manage news"
ON public.admin_news FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER admin_news_updated_at
BEFORE UPDATE ON public.admin_news
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_admin_news_pub ON public.admin_news (published, pub_date DESC);
CREATE INDEX idx_admin_news_category ON public.admin_news (category, pub_date DESC);

-- Remove cached external news
DELETE FROM public.news_cache;
