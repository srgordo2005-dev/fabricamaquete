-- Cache persistente de perfis de times (estilo Flashscore)
CREATE TABLE IF NOT EXISTS public.teams_cache (
  id integer PRIMARY KEY,
  name text NOT NULL,
  name_normalized text NOT NULL,
  logo text,
  country text,
  founded integer,
  code text,
  national boolean DEFAULT false,
  venue_name text,
  venue_city text,
  venue_capacity integer,
  venue_image text,
  league_id integer,
  league_name text,
  league_logo text,
  league_country text,
  league_flag text,
  league_season integer,
  rank integer,
  stats jsonb,
  squad jsonb,
  top_scorers jsonb,
  injuries jsonb,
  transfers jsonb,
  trophies jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_teams_cache_name_norm ON public.teams_cache (name_normalized);
CREATE INDEX IF NOT EXISTS idx_teams_cache_league ON public.teams_cache (league_id);

-- Próximos jogos e últimos resultados por time
CREATE TABLE IF NOT EXISTS public.team_fixtures_cache (
  fixture_id integer NOT NULL,
  team_id integer NOT NULL,
  kind text NOT NULL CHECK (kind IN ('next','last')),
  fixture_date timestamptz NOT NULL,
  status text,
  opponent_id integer,
  opponent_name text,
  opponent_logo text,
  venue text CHECK (venue IN ('H','A')),
  competition text,
  competition_logo text,
  result text CHECK (result IS NULL OR result IN ('V','E','D')),
  goals_for integer,
  goals_against integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (fixture_id, team_id, kind)
);
CREATE INDEX IF NOT EXISTS idx_tfc_team_kind_date ON public.team_fixtures_cache (team_id, kind, fixture_date);

-- Classificação por liga
CREATE TABLE IF NOT EXISTS public.standings_cache (
  league_id integer NOT NULL,
  season integer NOT NULL,
  rows jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (league_id, season)
);

-- Leitura pública (todos podem ver dados de times)
ALTER TABLE public.teams_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_fixtures_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standings_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read teams cache" ON public.teams_cache FOR SELECT USING (true);
CREATE POLICY "Public read team fixtures cache" ON public.team_fixtures_cache FOR SELECT USING (true);
CREATE POLICY "Public read standings cache" ON public.standings_cache FOR SELECT USING (true);