import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AdSlotId = "AD_TOP_01" | "AD_MID_02" | "AD_BOT_03";

interface Ad {
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  duration_sec: number;
  starts_at: string | null;
  ends_at: string | null;
}

const SLOT_ASPECT: Record<AdSlotId, string> = {
  AD_TOP_01: "aspect-[8/1]",
  AD_MID_02: "aspect-[4/1]",
  AD_BOT_03: "aspect-[6/1]",
};

export function AdSlot({ slot, className = "" }: { slot: AdSlotId; className?: string }) {
  const [ads, setAds] = useState<Ad[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const nowIso = new Date().toISOString();
      const { data } = await supabase
        .from("ads")
        .select("id,title,image_url,link_url,duration_sec,starts_at,ends_at")
        .eq("slot", slot)
        .eq("active", true);
      if (cancelled || !data) return;
      const valid = data.filter(a =>
        (!a.starts_at || a.starts_at <= nowIso) &&
        (!a.ends_at || a.ends_at >= nowIso)
      );
      setAds(valid);
    })();
    return () => { cancelled = true; };
  }, [slot]);

  useEffect(() => {
    if (ads.length <= 1) return;
    const dur = (ads[idx]?.duration_sec || 15) * 1000;
    const t = setTimeout(() => setIdx(i => (i + 1) % ads.length), dur);
    return () => clearTimeout(t);
  }, [ads, idx]);

  if (ads.length === 0) return null;
  const ad = ads[idx];

  const inner = (
    <div className={`relative w-full ${SLOT_ASPECT[slot]} overflow-hidden rounded-lg border border-border/50 bg-muted/20`}>
      <img src={ad.image_url} alt={ad.title} className="w-full h-full object-cover transition-opacity duration-[400ms]" loading="lazy" />
      <span className="absolute top-1 right-2 text-[9px] uppercase tracking-wider bg-black/50 text-white px-1.5 py-0.5 rounded">Ad</span>
    </div>
  );

  return (
    <div className={className}>
      {ad.link_url ? (
        <a href={ad.link_url} target="_blank" rel="noopener noreferrer sponsored">{inner}</a>
      ) : inner}
    </div>
  );
}
