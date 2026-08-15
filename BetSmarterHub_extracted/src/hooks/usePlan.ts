import { useEffect, useState, useCallback } from "react";

export type Plan = "free" | "root" | "bleachers" | "allin";

const KEY = "mb:plan";

export const PLAN_INFO: Record<Plan, { name: string; price: string; pro: boolean; perks: string[] }> = {
  free:      { name: "Free",       price: "R$ 0",      pro: false, perks: ["Dashboard", "Calculadora básica"] },
  root:      { name: "Root",       price: "R$ 19/mês", pro: true,  perks: ["IA básica", "Histórico ilimitado"] },
  bleachers: { name: "Bleachers",  price: "R$ 39/mês", pro: true,  perks: ["IA avançada", "Cercamento PRO", "Alertas"] },
  allin:     { name: "All-In",     price: "R$ 79/mês", pro: true,  perks: ["Tudo do Bleachers", "IPTV White Label", "Suporte VIP"] },
};

export function usePlan() {
  const [plan, setPlanState] = useState<Plan>("free");

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPlanState((localStorage.getItem(KEY) as Plan) || "free");
  }, []);

  const setPlan = useCallback((p: Plan) => {
    localStorage.setItem(KEY, p);
    setPlanState(p);
  }, []);

  return { plan, setPlan, info: PLAN_INFO[plan], isPro: PLAN_INFO[plan].pro };
}
