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
USING (true)
WITH CHECK (true);
