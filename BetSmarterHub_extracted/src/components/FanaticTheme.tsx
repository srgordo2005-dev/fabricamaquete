import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useFavoriteTeam } from "@/hooks/useFavoriteTeam";

const FANATIC_OFF_KEY = "mb:fanaticOff";

export function isFanaticEnabled() {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(FANATIC_OFF_KEY) !== "1";
}

export function setFanaticEnabled(on: boolean) {
  if (typeof window === "undefined") return;
  if (on) localStorage.removeItem(FANATIC_OFF_KEY);
  else localStorage.setItem(FANATIC_OFF_KEY, "1");
  window.dispatchEvent(new Event("mb:fanatic-toggle"));
}

/**
 * Fanatic Engine — só ativa para usuários LOGADOS com time escolhido.
 * Usuários não autenticados sempre veem o app neutro.
 */
export function FanaticTheme() {
  const { user } = useAuth();
  const { team } = useFavoriteTeam();

  const active = !!user && !!team && isFanaticEnabled();

  // re-render on toggle
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      // force update via root style reset
      const root = document.documentElement;
      root.style.setProperty("--__t", String(Math.random()));
    };
    window.addEventListener("mb:fanatic-toggle", handler);
    return () => window.removeEventListener("mb:fanatic-toggle", handler);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const body = document.body;
    if (!active || !team) {
      ["--primary", "--accent", "--ring", "--neon", "--team-primary", "--team-accent"].forEach(v => root.style.removeProperty(v));
      body.removeAttribute("data-team");
      return;
    }
    root.style.setProperty("--primary",      `oklch(${team.primary})`);
    root.style.setProperty("--accent",       `oklch(${team.accent})`);
    root.style.setProperty("--ring",         `oklch(${team.primary})`);
    root.style.setProperty("--neon",         `oklch(${team.primary})`);
    root.style.setProperty("--team-primary", `oklch(${team.primary})`);
    root.style.setProperty("--team-accent",  `oklch(${team.accent})`);
    body.setAttribute("data-team", team.id);
  }, [active, team]);

  if (!active || !team) return null;
  const badge = team.badge;

  return (
    <div aria-hidden className="fixed inset-0 -z-10 pointer-events-none overflow-hidden transition-opacity duration-[400ms]">
      {/* Base sólida com cores do time */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, oklch(${team.primary}) 0%, oklch(${team.accent}) 100%)`,
        }}
      />
      {/* Aurora/glow nos cantos */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(60% 70% at 10% 10%, oklch(${team.primary} / 0.9), transparent 60%),
            radial-gradient(60% 70% at 90% 90%, oklch(${team.accent} / 0.9), transparent 60%),
            radial-gradient(50% 60% at 50% 50%, oklch(${team.primary} / 0.4), transparent 70%)
          `,
        }}
      />
      {badge && (
        <div
          className="absolute top-1/2 -translate-y-1/2 left-[-6vw] w-[55vw] h-[80vh] bg-no-repeat bg-center bg-contain"
          style={{ backgroundImage: `url(${badge})`, opacity: 0.35, filter: "drop-shadow(0 0 60px rgba(0,0,0,0.55))" }}
        />
      )}
      {badge && (
        <div
          className="absolute top-1/2 -translate-y-1/2 right-[-6vw] w-[55vw] h-[80vh] bg-no-repeat bg-center bg-contain"
          style={{ backgroundImage: `url(${badge})`, opacity: 0.35, filter: "drop-shadow(0 0 60px rgba(0,0,0,0.55))" }}
        />
      )}
      {/* Vinheta sutil pra dar profundidade, sem clarear o centro */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.35) 100%)" }}
      />
    </div>
  );
}
