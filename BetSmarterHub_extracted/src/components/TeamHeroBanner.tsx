import { useFavoriteTeam } from "@/hooks/useFavoriteTeam";
import { useAuth } from "@/hooks/useAuth";
import { isFanaticEnabled } from "@/components/FanaticTheme";
import { useEffect, useState } from "react";

/**
 * Hero Banner do time — só aparece se: logado, time escolhido, fanatic on.
 */
export function TeamHeroBanner() {
  const { user } = useAuth();
  const { team } = useFavoriteTeam();
  const [, setTick] = useState(0);

  useEffect(() => {
    const h = () => setTick(t => t + 1);
    window.addEventListener("mb:fanatic-toggle", h);
    return () => window.removeEventListener("mb:fanatic-toggle", h);
  }, []);

  if (!user || !team || !isFanaticEnabled()) return null;

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-primary/40 mb-4 h-[120px] sm:h-[160px] glow"
      style={{
        background: `linear-gradient(110deg, oklch(${team.primary}) 0%, oklch(${team.accent}) 100%)`,
      }}
    >
      {team.badge && (
        <img
          src={team.badge}
          alt=""
          aria-hidden
          className="absolute right-4 top-1/2 -translate-y-1/2 h-[140%] opacity-60 drop-shadow-2xl"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/20 to-transparent" />
      <div className="relative z-10 h-full flex items-center px-6">
        <div>
          <div className="text-white/80 text-[10px] uppercase tracking-[0.2em] font-bold">{team.flag} {team.league}</div>
          <h2 className="text-white text-2xl sm:text-4xl font-black drop-shadow-lg">{team.name}</h2>
          <p className="text-white/90 text-xs sm:text-sm font-semibold">Modo Fanático ativado</p>
        </div>
      </div>
    </div>
  );
}
