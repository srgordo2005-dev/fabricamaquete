import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type FavEntity = "match" | "team";
export type Favorite = { id: string; entity_id: string; entity_type: FavEntity; metadata: Record<string, unknown> };

export function useFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) { setFavorites([]); setLoading(false); return; }
    const { data } = await supabase.from("user_favorites").select("id, entity_id, entity_type, metadata").eq("user_id", user.id);
    setFavorites((data ?? []) as Favorite[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const isFavorite = useCallback((entity_id: string, entity_type: FavEntity) =>
    favorites.some(f => f.entity_id === entity_id && f.entity_type === entity_type), [favorites]);

  const toggle = useCallback(async (entity_id: string, entity_type: FavEntity, metadata: Record<string, unknown> = {}) => {
    if (!user) return false;
    const exists = favorites.find(f => f.entity_id === entity_id && f.entity_type === entity_type);
    if (exists) {
      await supabase.from("user_favorites").delete().eq("id", exists.id);
      setFavorites(prev => prev.filter(f => f.id !== exists.id));
      return false;
    } else {
      const { data } = await supabase.from("user_favorites").insert({ user_id: user.id, entity_id, entity_type, metadata } as never).select().single();
      if (data) setFavorites(prev => [...prev, data as Favorite]);
      return true;
    }
  }, [user, favorites]);

  return { favorites, isFavorite, toggle, loading, refresh };
}
