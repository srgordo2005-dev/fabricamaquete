
CREATE TABLE public.ads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slot TEXT NOT NULL CHECK (slot IN ('AD_TOP_01','AD_MID_02','AD_BOT_03')),
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  link_url TEXT,
  duration_sec INTEGER NOT NULL DEFAULT 15,
  active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  team_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads active ads"
  ON public.ads FOR SELECT
  USING (active = true);

CREATE POLICY "Admins manage ads"
  ON public.ads FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_ads_updated
  BEFORE UPDATE ON public.ads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_ads_slot_active ON public.ads(slot, active);

INSERT INTO storage.buckets (id, name, public)
VALUES ('ads', 'ads', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read ads bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ads');

CREATE POLICY "Admins upload ads"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'ads' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update ads"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'ads' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete ads"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'ads' AND has_role(auth.uid(), 'admin'::app_role));
