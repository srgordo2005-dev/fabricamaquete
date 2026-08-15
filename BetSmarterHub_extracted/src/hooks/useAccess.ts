import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

// Cache em memória por sessão para evitar refazer RPC a cada navegação
const cache = new Map<string, { allowed: boolean; isAdmin: boolean }>();

export function useAccess() {
  const { user, loading: authLoading } = useAuth();
  const cached = user ? cache.get(user.id) : undefined;
  const [allowed, setAllowed] = useState<boolean | null>(cached ? cached.allowed : null);
  const [isAdmin, setIsAdmin] = useState<boolean>(cached ? cached.isAdmin : false);
  const [checking, setChecking] = useState<boolean>(!cached);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setAllowed(null); setIsAdmin(false); setChecking(false); return; }

    const hit = cache.get(user.id);
    if (hit) {
      setAllowed(hit.allowed);
      setIsAdmin(hit.isAdmin);
      setChecking(false);
      return;
    }

    setChecking(true);
    (async () => {
      const [okRes, adminRes] = await Promise.all([
        supabase.rpc("is_email_allowed", { _user_id: user.id }),
        supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
      ]);
      const ok = !!okRes.data;
      const adminOk = !!adminRes.data;
      cache.set(user.id, { allowed: ok, isAdmin: adminOk });
      setAllowed(ok);
      setIsAdmin(adminOk);
      setChecking(false);
    })();
  }, [user, authLoading]);

  return { user, allowed, isAdmin, loading: authLoading || checking };
}
