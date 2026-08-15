import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useFavoriteTeam } from "@/hooks/useFavoriteTeam";
import { TeamPicker } from "./TeamPicker";

/** Após login, força o usuário a escolher um time se ainda não tiver. */
export function TeamGate() {
  const { user } = useAuth();
  const { team, ready } = useFavoriteTeam();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (user && !team) setOpen(true);
    else setOpen(false);
  }, [user, team, ready]);

  if (!user || !ready) return null;
  return <TeamPicker open={open} onOpenChange={setOpen} forced={false} />;
}
