-- Criação da tabela de rastreamento da bola em tempo real para a Maquete
CREATE TABLE IF NOT EXISTS public.match_live_states (
    match_id TEXT PRIMARY KEY REFERENCES public.matches_cache(id) ON DELETE CASCADE,
    ball_x REAL DEFAULT 50.0,
    ball_y REAL DEFAULT 50.0,
    possession TEXT DEFAULT 'none', -- 'home', 'away' ou 'none'
    last_event TEXT DEFAULT 'normal', -- 'goal', 'foul', 'corner', 'normal', etc.
    event_desc TEXT DEFAULT '', -- Descrição em texto para leitores de tela
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilita o recurso de Realtime (tempo real via WebSockets) para esta tabela no Supabase
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_live_states;

-- Configura permissões de acesso públicas (para leitura) e autenticadas para atualização
ALTER TABLE public.match_live_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura pública dos estados ao vivo" 
ON public.match_live_states FOR SELECT 
USING (true);

CREATE POLICY "Permitir que admins atualizem estados ao vivo" 
ON public.match_live_states FOR ALL 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Inserção de partida mock de testes para o Campo Tátil para economizar requisições de API
INSERT INTO public.matches_cache (id, sport_key, league, home, away, commence_time, bookmaker_count, best_home, best_draw, best_away, bet365_home, bet365_draw, bet365_away, market_margin, favorite_prob, match_type, is_arb, home_goals, away_goals, status_short, status_elapsed, updated_at)
VALUES (
    'af_mock_sincronizacao',
    'af_mock',
    'Campeonato Brasileiro · Série A',
    'Flamengo (Maquete)',
    'Grêmio (Maquete)',
    NOW() + INTERVAL '1 day',
    1,
    1.85, 3.40, 4.20,
    1.85, 3.40, 4.20,
    5.0, 52.0, 'balanced', false,
    2, 1, '2H', 75,
    NOW()
)
ON CONFLICT (id) DO UPDATE 
SET home_goals = EXCLUDED.home_goals, 
    away_goals = EXCLUDED.away_goals,
    status_short = EXCLUDED.status_short,
    status_elapsed = EXCLUDED.status_elapsed,
    updated_at = NOW();

-- Inserção do estado inicial da bola para a partida mock
INSERT INTO public.match_live_states (match_id, ball_x, ball_y, possession, last_event, event_desc, updated_at)
VALUES ('af_mock_sincronizacao', 50.0, 50.0, 'none', 'normal', 'Partida de teste carregada', NOW())
ON CONFLICT (match_id) DO NOTHING;
