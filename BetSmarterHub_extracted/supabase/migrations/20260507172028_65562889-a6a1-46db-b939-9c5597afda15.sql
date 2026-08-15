-- ============ USER PROFILES ============
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  username text UNIQUE,
  display_name text,
  avatar_url text,
  xp integer NOT NULL DEFAULT 0,
  badges text[] NOT NULL DEFAULT '{}',
  favorite_team text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user ON public.user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_xp ON public.user_profiles(xp DESC);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles readable by authed"
  ON public.user_profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users insert own profile"
  ON public.user_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own profile"
  ON public.user_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_user_profiles_updated
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- Backfill existing users
INSERT INTO public.user_profiles (user_id, display_name, avatar_url)
SELECT u.id,
  COALESCE(u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'name', split_part(u.email,'@',1)),
  u.raw_user_meta_data->>'avatar_url'
FROM auth.users u
LEFT JOIN public.user_profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL;

-- ============ MATCH PREDICTIONS ============
CREATE TABLE IF NOT EXISTS public.match_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id text NOT NULL,
  user_id uuid NOT NULL,
  display_name text NOT NULL,
  avatar_url text,
  home_score integer NOT NULL CHECK (home_score BETWEEN 0 AND 30),
  away_score integer NOT NULL CHECK (away_score BETWEEN 0 AND 30),
  xp_awarded integer NOT NULL DEFAULT 10,
  result text NOT NULL DEFAULT 'pending' CHECK (result IN ('exact','winner','wrong','pending')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(match_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_predictions_match ON public.match_predictions(match_id);
CREATE INDEX IF NOT EXISTS idx_predictions_user ON public.match_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_pending ON public.match_predictions(result) WHERE result = 'pending';

ALTER TABLE public.match_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own predictions"
  ON public.match_predictions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Authed users can read everyone's predictions for matches that already finished
-- (we restrict via the matches_cache status in the app layer — RLS keeps base safe)
CREATE POLICY "Authed view all predictions for evaluated matches"
  ON public.match_predictions FOR SELECT TO authenticated
  USING (result <> 'pending');

CREATE POLICY "Users insert own prediction"
  ON public.match_predictions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own prediction"
  ON public.match_predictions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_predictions_updated
  BEFORE UPDATE ON public.match_predictions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ STORAGE: AVATARS ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatars public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users upload own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own avatar"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);