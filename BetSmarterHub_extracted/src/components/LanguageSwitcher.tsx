import { useTranslation } from "react-i18next";
import { LANGS } from "@/lib/i18n";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: Math.max(8, r.right - 160) });
    const onClick = (e: MouseEvent) => {
      if (
        !btnRef.current?.contains(e.target as Node) &&
        !menuRef.current?.contains(e.target as Node)
      ) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const current = LANGS.find(l => l.code === (i18n.resolvedLanguage || i18n.language)?.slice(0, 2)) ?? LANGS[0];

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-2 py-1 rounded-md border border-border/60 bg-background/40 hover:bg-muted/60 text-xs font-semibold"
        style={{ color: "var(--nav-fg, hsl(var(--foreground)))" }}
        aria-label="Idioma"
      >
        <span className="text-base leading-none">{current.flag}</span>
        <span className="hidden sm:inline">{current.code.toUpperCase()}</span>
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, width: 160, zIndex: 9999 }}
          className="rounded-md border border-border/60 bg-popover shadow-lg overflow-hidden"
        >
          {LANGS.map(l => (
            <button
              key={l.code}
              type="button"
              onClick={() => { i18n.changeLanguage(l.code); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-muted/40 flex items-center gap-2 ${l.code === current.code ? "bg-muted/30 font-semibold" : ""}`}
            >
              <span className="text-base">{l.flag}</span> {l.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
