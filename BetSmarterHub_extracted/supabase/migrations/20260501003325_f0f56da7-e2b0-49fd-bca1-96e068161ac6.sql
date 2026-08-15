
-- Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  display_name TEXT,
  initial_bankroll NUMERIC(12,2) NOT NULL DEFAULT 1000,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Bets table (tracks dutching groups & individual selections)
CREATE TABLE public.bets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  match_id TEXT,
  match_name TEXT NOT NULL,
  league TEXT,
  commence_time TIMESTAMP WITH TIME ZONE,
  market TEXT NOT NULL,
  selections JSONB NOT NULL,
  total_stake NUMERIC(12,2) NOT NULL,
  guaranteed_return NUMERIC(12,2) NOT NULL,
  expected_profit NUMERIC(12,2) NOT NULL,
  profit_margin NUMERIC(6,3) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  actual_profit NUMERIC(12,2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own bets" ON public.bets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own bets" ON public.bets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own bets" ON public.bets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own bets" ON public.bets FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_bets_user_created ON public.bets(user_id, created_at DESC);
CREATE INDEX idx_bets_status ON public.bets(user_id, status);

-- Updated-at function & triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_bets_updated BEFORE UPDATE ON public.bets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
