import { Link } from "@tanstack/react-router";
import { Gamepad2, Target, Trophy, History, LogOut, Star, Newspaper, Accessibility } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useFavoriteTeam } from "@/hooks/useFavoriteTeam";

import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { isFanaticEnabled } from "@/components/FanaticTheme";
import logoResulta from "@/assets/resulta_logo.jpg";
import { AdSlot } from "@/components/AdSlot";

function AlternatingBrand({ teamName }: { teamName: string }) {
  const [showTeam, setShowTeam] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setShowTeam(v => !v), 3000);
    return () => clearInterval(id);
  }, []);
  return (
    <span key={showTeam ? "t" : "a"} className="inline-block animate-fade-in">
      {showTeam ? teamName : "resulta."}
    </span>
  );
}

export function Header() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const { team } = useFavoriteTeam();
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    import("@/integrations/supabase/client").then(({ supabase }) => {
      supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => setIsAdmin(!!data));
    });
  }, [user]);
  useEffect(() => {
    const h = () => setTick(x => x + 1);
    window.addEventListener("mb:fanatic-toggle", h);
    return () => window.removeEventListener("mb:fanatic-toggle", h);
  }, []);
  const fanatic = !!user && !!team && isFanaticEnabled();
  return (
    <header
      className="border-b border-border/60 backdrop-blur-xl sticky top-0 z-30 transition-colors duration-[400ms]"
      style={fanatic ? {
        background: `color-mix(in oklab, oklch(${team!.primary}) 70%, transparent)`,
      } : { backgroundColor: "color-mix(in oklab, var(--background) 60%, transparent)" }}
    >
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-primary/30 to-accent/30 grid place-items-center glow transition-transform group-hover:scale-105 ring-1 ring-primary/40 overflow-hidden">
            {fanatic && team!.badge ? (
              <img src={team!.badge} alt={team!.name} width={40} height={40} className="w-9 h-9 object-contain drop-shadow-[0_0_8px_rgba(0,0,0,0.6)]" />
            ) : (
              <img src={logoResulta} alt="resulta." width={40} height={40} className="w-full h-full object-cover" />
            )}
          </div>
          <span className={`text-xl font-bold tracking-tight hidden sm:inline ${fanatic ? "text-white drop-shadow" : "text-grad-neon"}`}>
            {fanatic ? <AlternatingBrand teamName={team!.name} /> : "resulta."}
          </span>
        </Link>
        <nav className={`flex items-center gap-1 lg:gap-3 text-sm flex-1 justify-end overflow-x-auto no-scrollbar ${fanatic ? "[--nav-fg:white] [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]" : "[--nav-fg:hsl(var(--foreground))]"}`}>
          <Link to="/acessivel-ja" title="Acessível.Já" className="group flex items-center gap-1.5 px-2 py-1 rounded-md hover:text-primary hover:bg-accent/40 transition-colors shrink-0" style={{ color: "var(--nav-fg)" }} activeProps={{ className: "font-semibold text-primary" }}>
            <Accessibility className="w-5 h-5 text-primary animate-pulse" /> <span className="hidden group-hover:inline xl:inline">Acessível.Já</span>
          </Link>
          <Link to="/dashboard" title={t("nav.games")} className="group flex items-center gap-1.5 px-2 py-1 rounded-md hover:text-primary hover:bg-accent/40 transition-colors shrink-0" style={{ color: "var(--nav-fg)" }} activeProps={{ className: "font-semibold" }}>
            <Gamepad2 className="w-5 h-5" /> <span className="hidden group-hover:inline xl:inline">{t("nav.games")}</span>
          </Link>
          <Link to="/cercamento" title={t("nav.cerc")} className="group flex items-center gap-1.5 px-2 py-1 rounded-md hover:text-primary hover:bg-accent/40 transition-colors shrink-0" style={{ color: "var(--nav-fg)" }} activeProps={{ className: "font-semibold" }}>
            <Target className="w-5 h-5" /> <span className="hidden group-hover:inline xl:inline">{t("nav.cerc")}</span>
          </Link>
          {user && <Link to="/palpites" title={t("nav.picks")} className="group flex items-center gap-1.5 px-2 py-1 rounded-md hover:text-primary hover:bg-accent/40 transition-colors shrink-0" style={{ color: "var(--nav-fg)" }} activeProps={{ className: "font-semibold" }}>
            <Trophy className="w-5 h-5" /> <span className="hidden group-hover:inline xl:inline">{t("nav.picks")}</span>
          </Link>}
          {user && <Link to="/history" title={t("nav.history")} className="group flex items-center gap-1.5 px-2 py-1 rounded-md hover:text-primary hover:bg-accent/40 transition-colors shrink-0" style={{ color: "var(--nav-fg)" }} activeProps={{ className: "font-semibold" }}>
            <History className="w-5 h-5" /> <span className="hidden group-hover:inline xl:inline">{t("nav.history")}</span>
          </Link>}
          <Link to="/noticias" title="Notícias" className="group flex items-center gap-1.5 px-2 py-1 rounded-md hover:text-primary hover:bg-accent/40 transition-colors shrink-0" style={{ color: "var(--nav-fg)" }} activeProps={{ className: "font-semibold" }}>
            <Newspaper className="w-5 h-5" /> <span className="hidden group-hover:inline xl:inline">Notícias</span>
          </Link>
          <Link to="/favoritos" title="Favoritos" className="group flex items-center gap-1.5 px-2 py-1 rounded-md hover:text-primary hover:bg-accent/40 transition-colors shrink-0" style={{ color: "var(--nav-fg)" }} activeProps={{ className: "font-semibold" }}>
            <Star className="w-5 h-5" /> <span className="hidden group-hover:inline xl:inline">Favoritos</span>
          </Link>
          {user && <NotificationBell />}
          {user && team && (
            <Link to="/profile" className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-primary/30 hover:bg-primary/10 transition-colors shrink-0" style={{ color: "var(--nav-fg)" }}>
              <span className="text-lg leading-none">{team.logo}</span>
              <span className="text-xs font-semibold hidden md:inline">{team.shortName}</span>
              
            </Link>
          )}
          <LanguageSwitcher />
          {user ? (
            <Button variant="ghost" size="sm" onClick={() => { signOut(); window.location.href = "/"; }} style={{ color: "var(--nav-fg)" }} className="shrink-0">
              <LogOut className="w-5 h-5" /> <span className="hidden lg:inline ml-1">{t("nav.logout")}</span>
            </Button>
          ) : (
            <Link to="/auth"><Button size="sm" variant="outline">{t("nav.login")}</Button></Link>
          )}
        </nav>
      </div>
    </header>
  );
}

export function ResponsibleFooter() {
  const { t } = useTranslation();
  return (
    <>
      <AdSlot slot="AD_BOT_03" className="max-w-4xl mx-auto my-6 px-4" />
      <footer className="border-t border-border/60 mt-8 py-8 px-4 text-center text-xs text-muted-foreground space-y-2 max-w-4xl mx-auto">
        <p className="font-semibold text-sm text-foreground">{t("footer.responsible")}</p>
        <p>{t("footer.odds")}</p>
        <p>{t("footer.disclaimer")}</p>
        <p>{t("footer.help")}</p>
        <p className="pt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
          <Link to="/termos" className="underline hover:text-primary">{t("footer.terms")}</Link>
          <span>|</span>
          <Link to="/privacidade" className="underline hover:text-primary">{t("footer.privacy")}</Link>
          <span>|</span>
          <a href="mailto:srgordo2005@gmail.com" className="underline hover:text-primary">{t("footer.contact")}</a>
        </p>
        <p className="pt-2 opacity-70">© {new Date().getFullYear()} resulta. — {t("footer.copyright")}</p>
      </footer>
    </>
  );
}

