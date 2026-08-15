-- ============ MATCH CHAT ============
CREATE TABLE IF NOT EXISTS public.match_chat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id text NOT NULL,
  user_id uuid NOT NULL,
  display_name text NOT NULL,
  avatar_url text,
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 300),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_chat_match_created
  ON public.match_chat (match_id, created_at DESC);

ALTER TABLE public.match_chat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read chat"
  ON public.match_chat FOR SELECT USING (true);

CREATE POLICY "Authed users insert own messages"
  ON public.match_chat FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own messages"
  ON public.match_chat FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============ MATCH VOTES ============
CREATE TABLE IF NOT EXISTS public.match_votes (
  match_id text NOT NULL,
  user_id uuid NOT NULL,
  vote text NOT NULL CHECK (vote IN ('home','draw','away')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_match_votes_match
  ON public.match_votes (match_id);

ALTER TABLE public.match_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read votes"
  ON public.match_votes FOR SELECT USING (true);

CREATE POLICY "Authed users insert own vote"
  ON public.match_votes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own vote"
  ON public.match_votes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own vote"
  ON public.match_votes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_match_votes_updated
  BEFORE UPDATE ON public.match_votes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ VIEW DE CONTAGEM ============
CREATE OR REPLACE VIEW public.match_vote_counts AS
SELECT
  match_id,
  COUNT(*) FILTER (WHERE vote = 'home') AS home_votes,
  COUNT(*) FILTER (WHERE vote = 'draw') AS draw_votes,
  COUNT(*) FILTER (WHERE vote = 'away') AS away_votes,
  COUNT(*) AS total_votes
FROM public.match_votes
GROUP BY match_id;

-- ============ REALTIME ============
ALTER TABLE public.match_chat REPLICA IDENTITY FULL;
ALTER TABLE public.match_votes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_chat;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_votes;