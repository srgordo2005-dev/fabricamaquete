import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const BADGES = [
  { id: "first_pick",    name: "Primeiro Palpite",     icon: "🎯", desc: "Faça seu primeiro palpite" },
  { id: "hot_streak",    name: "Em Chamas",            icon: "🔥", desc: "3 acertos seguidos" },
  { id: "fanatic",       name: "Fanático",             icon: "💎", desc: "Escolha seu time do coração" },
  { id: "level_5",       name: "Veterano",             icon: "🛡️", desc: "Alcance o nível 5" },
  { id: "level_10",      name: "Mestre dos Palpites",  icon: "👑", desc: "Alcance o nível 10" },
  { id: "brasil_fan",    name: "Torcedor Brasileiro",  icon: "⚽", desc: "Time favorito é brasileiro" },
  { id: "daily_voter",   name: "Votante Assíduo",      icon: "🗓️", desc: "Vote em 7 jogos diferentes" },
  { id: "exact_score",   name: "Placar Exato",         icon: "🏆", desc: "Acerte um placar exato" },
  { id: "perfect_week",  name: "Semana Perfeita",      icon: "🌟", desc: "5 palpites certos em 7 dias" },
  { id: "dutch_master",  name: "Mestre do Dutching",   icon: "🎲", desc: "Use dutching 5 vezes" },
  { id: "streaker_5",    name: "Sequência Lendária",   icon: "📈", desc: "5 acertos seguidos" },
  { id: "veteran",       name: "Lenda",                icon: "🦁", desc: "50 palpites realizados" },
];

export interface ProfileRow {
  id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  xp: number;
  badges: string[];
  favorite_team: string | null;
}

const xpForLevel = (lvl: number) => Math.floor(100 * Math.pow(1.4, lvl - 1));
function compute(xp: number) {
  let level = 1, remaining = xp, need = xpForLevel(1);
  while (remaining >= need) { remaining -= need; level++; need = xpForLevel(level); }
  return { level, nextLevelXp: need - remaining };
}

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) { setProfile(null); setLoading(false); return; }
    const { data } = await supabase.from("user_profiles").select("*").eq("user_id", user.id).maybeSingle();
    setProfile((data as ProfileRow) ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime updates to own profile
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`profile:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_profiles", filter: `user_id=eq.${user.id}` },
        (p) => setProfile(p.new as ProfileRow))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const addXP = useCallback(async (amount: number) => {
    if (!user || !profile) return;
    const next = Math.max(0, profile.xp + amount);
    await supabase.from("user_profiles").update({ xp: next }).eq("user_id", user.id);
  }, [user, profile]);

  const unlockBadge = useCallback(async (id: string) => {
    if (!user || !profile) return;
    if (profile.badges.includes(id)) return;
    const next = [...profile.badges, id];
    await supabase.from("user_profiles").update({ badges: next }).eq("user_id", user.id);
  }, [user, profile]);

  const updateProfile = useCallback(async (patch: Partial<Pick<ProfileRow, "username" | "display_name" | "avatar_url" | "favorite_team">>) => {
    if (!user) return { error: "Not authenticated" };
    const { error } = await supabase.from("user_profiles").update(patch).eq("user_id", user.id);
    return { error: error?.message };
  }, [user]);

  const xp = profile?.xp ?? 0;
  const badges = profile?.badges ?? [];
  const { level, nextLevelXp } = compute(xp);

  return { profile, loading, xp, level, nextLevelXp, badges, addXP, unlockBadge, updateProfile, refresh };
}
