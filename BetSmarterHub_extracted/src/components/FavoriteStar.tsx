import { Star } from "lucide-react";
import { useFavorites, type FavEntity } from "@/hooks/useFavorites";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { toast } from "sonner";

export function FavoriteStar({
  entityId,
  entityType,
  metadata,
  size = 20,
  className = "",
}: {
  entityId: string;
  entityType: FavEntity;
  metadata?: Record<string, unknown>;
  size?: number;
  className?: string;
}) {
  const { user } = useAuth();
  const { isFavorite, toggle } = useFavorites();
  const [bounce, setBounce] = useState(false);
  const active = isFavorite(entityId, entityType);

  return (
    <button
      type="button"
      aria-label={active ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      onClick={async (e) => {
        e.stopPropagation(); e.preventDefault();
        if (!user) { toast.error("Faça login para favoritar"); return; }
        setBounce(true); setTimeout(() => setBounce(false), 220);
        if ("vibrate" in navigator) navigator.vibrate?.(15);
        const now = await toggle(entityId, entityType, metadata);
        toast.success(now ? "Favorito adicionado ⭐" : "Favorito removido");
      }}
      className={`inline-flex items-center justify-center transition-transform ${bounce ? "scale-125" : "scale-100"} hover:scale-110 ${className}`}
    >
      <Star
        size={size}
        className={active ? "fill-primary text-primary drop-shadow-[0_0_6px_oklch(var(--primary)/0.6)]" : "text-muted-foreground hover:text-primary"}
        strokeWidth={2}
      />
    </button>
  );
}
