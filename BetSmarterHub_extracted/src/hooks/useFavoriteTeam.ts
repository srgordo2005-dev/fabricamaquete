import { useEffect, useState, useCallback } from "react";
import { getTeam, type TeamTheme } from "@/data/teams";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const KEY = "mb:favoriteTeam";

export function useFavoriteTeam() {
  const { user } = useAuth();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Boot from localStorage immediately for snappy UI
  useEffect(() => {
    if (typeof window === "undefined") return;
    setTeamId(localStorage.getItem(KEY));
    setReady(true);
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) setTeamId(e.newValue); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // When user logs in, sync from/to Supabase profile
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("favorite_team")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const remote = data?.favorite_team ?? null;
      const local = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
      if (remote && remote !== local) {
        // Remote wins — fresh login on new device
        localStorage.setItem(KEY, remote);
        setTeamId(remote);
      } else if (!remote && local) {
        // Push local pick up to profile
        await supabase.from("user_profiles").update({ favorite_team: local }).eq("user_id", user.id);
      }
    })();

    // Realtime sync of favorite_team changes (unique channel name per mount avoids StrictMode reuse)
    const ch = supabase
      .channel(`fav-team:${user.id}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "user_profiles", filter: `user_id=eq.${user.id}` },
        (p) => {
          const next = (p.new as { favorite_team: string | null })?.favorite_team ?? null;
          if (next !== teamId) {
            if (next) localStorage.setItem(KEY, next); else localStorage.removeItem(KEY);
            setTeamId(next);
          }
        })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const setTeam = useCallback(async (id: string | null) => {
    if (typeof window === "undefined") return;
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
    setTeamId(id);
    window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: id }));
    if (user) {
      await supabase.from("user_profiles").update({ favorite_team: id }).eq("user_id", user.id);
      // Unlock fanatic badge
      if (id) {
        const { data: prof } = await supabase.from("user_profiles").select("badges").eq("user_id", user.id).maybeSingle();
        const badges: string[] = prof?.badges ?? [];
        if (!badges.includes("fanatic")) {
          await supabase.from("user_profiles").update({ badges: [...badges, "fanatic"] }).eq("user_id", user.id);
        }
      }
    }
  }, [user]);

  // Only expose the team when the user is authenticated — guests always see the neutral app
  const team: TeamTheme | undefined = user ? getTeam(teamId) : undefined;
  return { team, teamId: user ? teamId : null, setTeam, ready };
}
