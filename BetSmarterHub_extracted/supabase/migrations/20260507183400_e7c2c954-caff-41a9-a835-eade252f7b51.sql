
-- Favorites
CREATE TABLE IF NOT EXISTS public.user_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entity_id text NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('match','team')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, entity_id, entity_type)
);
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fav_select_own" ON public.user_favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "fav_insert_own" ON public.user_favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "fav_delete_own" ON public.user_favorites FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON public.user_favorites(user_id);

-- Notification preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY,
  goals boolean NOT NULL DEFAULT true,
  cards boolean NOT NULL DEFAULT false,
  match_start boolean NOT NULL DEFAULT true,
  match_end boolean NOT NULL DEFAULT true,
  team_news boolean NOT NULL DEFAULT true,
  quiet_start text,
  quiet_end text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "np_select_own" ON public.notification_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "np_upsert_own" ON public.notification_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "np_update_own" ON public.notification_preferences FOR UPDATE USING (auth.uid() = user_id);

-- Notifications log
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_select_own" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notif_insert_own" ON public.notifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notif_delete_own" ON public.notifications FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
