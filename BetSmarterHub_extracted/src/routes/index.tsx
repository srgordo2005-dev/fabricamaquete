import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Header, ResponsibleFooter } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  const { t } = useTranslation();
  const features = [
    { t: t("landing.f1t"), d: t("landing.f1d") },
    { t: t("landing.f2t"), d: t("landing.f2d") },
    { t: t("landing.f3t"), d: t("landing.f3d") },
  ];
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <section className="max-w-6xl mx-auto px-4 pt-20 pb-16 text-center">
          <span className="inline-block px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-semibold tracking-wider uppercase">{t("landing.badge")}</span>
          <h1 className="mt-6 text-5xl md:text-7xl font-bold tracking-tight leading-[1.05]">
            {t("landing.title1")} <br />
            <span className="grad-neon bg-clip-text text-transparent">{t("landing.title2")}</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">{t("landing.subtitle")}</p>
          <div className="mt-10 flex justify-center gap-3">
            <Link to="/dashboard"><Button size="lg" className="grad-neon text-primary-foreground font-semibold glow">{t("landing.ctaGames")}</Button></Link>
            <Link to="/history"><Button size="lg" variant="outline">{t("landing.ctaHistory")}</Button></Link>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 grid md:grid-cols-3 gap-6 pb-20">
          {features.map((f) => (
            <Card key={f.t} className="card-elev p-6">
              <h3 className="text-lg font-semibold text-primary">{f.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.d}</p>
            </Card>
          ))}
        </section>
      </main>
      <ResponsibleFooter />
    </div>
  );
}
