import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { FanaticTheme } from "@/components/FanaticTheme";
import { TeamGate } from "@/components/TeamGate";
import { GlobalAds } from "@/components/GlobalAds";
import "@/lib/i18n";
import { installSupabaseFetchInterceptor } from "@/integrations/supabase/fetch-interceptor";

installSupabaseFetchInterceptor();

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "minhaAPOSTA — Cotações ao vivo & Dutching" },
      { name: "description", content: "Compare odds em tempo real entre Bet365, Betano e mais. Calculadora de Dutching com lucro garantido." },
      { name: "author", content: "minhaAPOSTA" },
      { property: "og:title", content: "minhaAPOSTA — Cotações ao vivo & Dutching" },
      { property: "og:description", content: "Compare odds em tempo real entre Bet365, Betano e mais. Calculadora de Dutching com lucro garantido." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "minhaAPOSTA — Cotações ao vivo & Dutching" },
      { name: "twitter:description", content: "Compare odds em tempo real entre Bet365, Betano e mais. Calculadora de Dutching com lucro garantido." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/fa3d7edf-30d0-4870-95a0-526bc99016d6/id-preview-a0dfe8eb--fe00d940-357b-43f2-a966-dcbc1d21df74.lovable.app-1777646560384.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/fa3d7edf-30d0-4870-95a0-526bc99016d6/id-preview-a0dfe8eb--fe00d940-357b-43f2-a966-dcbc1d21df74.lovable.app-1777646560384.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <>
      <div className="app-bg-float" aria-hidden="true">
        <span className="float-icon">⚽</span>
        <span className="float-icon">🏆</span>
        <span className="float-icon">💰</span>
        <span className="float-icon">🥅</span>
        <span className="float-icon">⚡</span>
        <span className="float-icon">🏆</span>
        <span className="float-icon">⭐</span>
        <span className="float-icon">🎯</span>
        <span className="float-icon">💎</span>
        <span className="float-icon">⚽</span>
        <span className="float-icon">🔥</span>
        <span className="float-icon">👑</span>
        <span className="float-icon">✨</span>
        <span className="float-icon">🏅</span>
      </div>
      <FanaticTheme />
      <TeamGate />
      <GlobalAds />
      <Outlet />
    </>
  );
}
