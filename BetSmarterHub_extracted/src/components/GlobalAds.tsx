import { useEffect, useState } from "react";
import { AdSlot } from "@/components/AdSlot";
import { X } from "lucide-react";

/**
 * Renderiza 3 banners em TODAS as páginas:
 *  - AD_TOP_01: fixo no topo (sticky, sempre visível)
 *  - AD_MID_02: flutuante (canto inferior esquerdo)
 *  - AD_BOT_03: flutuante (canto inferior direito)
 */
export function GlobalAds() {
  const [hideTop, setHideTop] = useState(false);
  const [hideLeft, setHideLeft] = useState(false);
  const [hideRight, setHideRight] = useState(false);

  // Reabrir banners depois de algumas páginas (sessionStorage para não irritar)
  useEffect(() => {
    setHideTop(sessionStorage.getItem("ad_hide_top") === "1");
    setHideLeft(sessionStorage.getItem("ad_hide_left") === "1");
    setHideRight(sessionStorage.getItem("ad_hide_right") === "1");
  }, []);

  const close = (which: "top" | "left" | "right") => {
    sessionStorage.setItem(`ad_hide_${which}`, "1");
    if (which === "top") setHideTop(true);
    if (which === "left") setHideLeft(true);
    if (which === "right") setHideRight(true);
  };

  return (
    <>
      {/* 1) Banner fixo no topo */}
      {!hideTop && (
        <div className="sticky top-0 z-40 w-full bg-background/95 backdrop-blur-sm border-b border-border/40">
          <div className="max-w-7xl mx-auto px-4 py-1 relative">
            <AdSlot slot="AD_TOP_01" />
            <button
              onClick={() => close("top")}
              aria-label="Fechar anúncio"
              className="absolute top-1 right-2 p-1 rounded-full bg-background/80 hover:bg-background border border-border text-muted-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* 2) Banner flutuante inferior esquerdo */}
      {!hideLeft && (
        <div className="fixed bottom-3 left-3 z-40 w-[280px] max-w-[40vw] hidden md:block">
          <div className="relative shadow-lg rounded-lg overflow-hidden">
            <AdSlot slot="AD_MID_02" />
            <button
              onClick={() => close("left")}
              aria-label="Fechar anúncio"
              className="absolute top-1 right-1 p-1 rounded-full bg-background/80 hover:bg-background border border-border text-muted-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* 3) Banner flutuante inferior direito */}
      {!hideRight && (
        <div className="fixed bottom-3 right-3 z-40 w-[280px] max-w-[40vw]">
          <div className="relative shadow-lg rounded-lg overflow-hidden">
            <AdSlot slot="AD_BOT_03" />
            <button
              onClick={() => close("right")}
              aria-label="Fechar anúncio"
              className="absolute top-1 right-1 p-1 rounded-full bg-background/80 hover:bg-background border border-border text-muted-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
