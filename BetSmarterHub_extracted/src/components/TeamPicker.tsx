import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TEAMS, LEAGUES } from "@/data/teams";
import { useFavoriteTeam } from "@/hooks/useFavoriteTeam";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  forced?: boolean; // bloqueia fechar
}

export function TeamPicker({ open, onOpenChange, forced }: Props) {
  const { setTeam, teamId } = useFavoriteTeam();
  const [q, setQ] = useState("");
  const [league, setLeague] = useState<string>("Todos");

  const filtered = useMemo(() => {
    return TEAMS.filter(t =>
      (league === "Todos" || t.league === league) &&
      (q === "" || t.name.toLowerCase().includes(q.toLowerCase()))
    );
  }, [q, league]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!forced || v) onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Escolha seu time do coração ⚽</DialogTitle>
          <DialogDescription>O app vai pintar tudo com as cores do seu time.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input placeholder="Buscar time..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {["Todos", ...LEAGUES].map(l => (
            <Button key={l} size="sm" variant={league === l ? "default" : "outline"} onClick={() => setLeague(l)}>
              {l}
            </Button>
          ))}
        </div>

        <div className="overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2 pr-1">
          {filtered.map(t => (
            <button
              key={t.id}
              onClick={() => { setTeam(t.id); onOpenChange(false); }}
              className={`text-left p-3 rounded-lg border transition-all hover:scale-[1.02] ${teamId === t.id ? "border-primary ring-2 ring-primary/30" : "border-border/60"}`}
              style={{ background: `linear-gradient(135deg, oklch(${t.primary} / 0.15), oklch(${t.accent} / 0.10))` }}
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl">{t.logo}</span>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{t.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{t.flag} {t.league}</div>
                </div>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground text-center py-8">Nenhum time encontrado.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
