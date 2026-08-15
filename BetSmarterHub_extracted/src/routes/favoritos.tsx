import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header, ResponsibleFooter } from "@/components/Layout";
import { useFavorites } from "@/hooks/useFavorites";
import { useAuth } from "@/hooks/useAuth";
import { useFavoriteTeam } from "@/hooks/useFavoriteTeam";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FavoriteStar } from "@/components/FavoriteStar";
import { Star } from "lucide-react";

export const Route = createFileRoute("/favoritos")({ component: FavoritosPage });

const FINISHED = new Set(["FT", "AET", "PEN", "CANC", "ABD", "AWD", "WO"]);
const HIDE_AFTER_MS = 30 * 60 * 1000; // 30 min after match ended

function FavoritosPage() {
  const { user } = useAuth();
  const { team: fanaticTeam } = useFavoriteTeam();
  const { favorites, loading } = useFavorites();
  const allMatches = favorites.filter(f => f.entity_type === "match");
  const teams = favorites.filter(f => f.entity_type === "team");

  const [matchStatus, setMatchStatus] = useState<Record<string, { status_short: string | null; updated_at: string }>>({});
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (allMatches.length === 0) return;
    const ids = allMatches.map(m => m.entity_id);
    supabase.from("matches_cache").select("id,status_short,updated_at").in("id", ids)
      .then(({ data }) => {
        const map: Record<string, { status_short: string | null; updated_at: string }> = {};
        (data ?? []).forEach((r: { id: string; status_short: string | null; updated_at: string }) => {
          map[r.id] = { status_short: r.status_short, updated_at: r.updated_at };
        });
        setMatchStatus(map);
      });
  }, [allMatches.length]);

  const matches = allMatches.filter(f => {
    const s = matchStatus[f.entity_id];
    if (s && s.status_short && FINISHED.has(s.status_short)) {
      return now - new Date(s.updated_at).getTime() < HIDE_AFTER_MS;
    }
    // Fallback: hide if commence_time + 3h + 30min passou (sem dados de cache)
    const commence = (f.metadata as { commence_time?: string })?.commence_time;
    if (commence && !s) {
      const end = new Date(commence).getTime() + (3 * 60 + 30) * 60 * 1000;
      if (now > end) return false;
    }
    return true;
  });

  return (
    <>
      <Header />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6 flex items-center gap-2"><Star className="w-7 h-7 fill-primary text-primary" /> Meus Favoritos</h1>
        {!user ? (
          <Card className="p-8 text-center text-muted-foreground">Faça login para gerenciar seus favoritos.</Card>
        ) : loading ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : (
          <Tabs defaultValue="games">
            <TabsList>
              <TabsTrigger value="games">Jogos ({matches.length})</TabsTrigger>
              <TabsTrigger value="teams">Times ({teams.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="games" className="mt-4 space-y-2">
              {matches.length === 0 ? <p className="text-muted-foreground text-sm">Nenhum jogo favorito ativo. Jogos somem 30 min após o término.</p> : matches.map(f => (
                <Card key={f.id} className="p-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm">{(f.metadata as { name?: string })?.name ?? f.entity_id}</div>
                    <div className="text-xs text-muted-foreground">{(f.metadata as { league?: string })?.league}</div>
                  </div>
                  <FavoriteStar entityId={f.entity_id} entityType="match" metadata={f.metadata} />
                </Card>
              ))}
            </TabsContent>
            <TabsContent value="teams" className="mt-4 space-y-2">
              {fanaticTeam && (
                <Card className="p-3 flex items-center justify-between border-yellow-400/60 bg-gradient-to-r from-yellow-500/10 to-transparent shadow-[0_0_20px_-8px_rgba(250,204,21,0.6)]">
                  <div className="flex items-center gap-3">
                    {fanaticTeam.badge ? (
                      <img src={fanaticTeam.badge} alt={fanaticTeam.name} className="w-10 h-10 object-contain" />
                    ) : (
                      <span className="text-2xl">{fanaticTeam.logo}</span>
                    )}
                    <div>
                      <div className="font-bold flex items-center gap-1.5">
                        {fanaticTeam.name}
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400 drop-shadow-[0_0_4px_rgba(250,204,21,0.8)]" />
                      </div>
                      <div className="text-[11px] uppercase tracking-wider font-semibold text-yellow-500">
                        ⭐ Time do peito · Fanático
                      </div>
                    </div>
                  </div>
                </Card>
              )}
              {teams.length === 0 && !fanaticTeam ? (
                <p className="text-muted-foreground text-sm">Nenhum time favorito.</p>
              ) : teams.map(f => (
                <Card key={f.id} className="p-3 flex items-center justify-between">
                  <div className="font-semibold">{(f.metadata as { name?: string })?.name ?? f.entity_id}</div>
                  <FavoriteStar entityId={f.entity_id} entityType="team" metadata={f.metadata} />
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        )}
      </div>
      <ResponsibleFooter />
    </>
  );
}
