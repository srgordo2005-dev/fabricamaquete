import { useAccess } from "@/hooks/useAccess";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Lock, Loader2 } from "lucide-react";

export function AccessGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAccess();
  const allowed = true; // allowlist removida — basta estar logado

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <div className="text-grad-neon text-lg font-semibold tracking-wide">MinhaAPOSTA carregando...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="card-elev p-8 max-w-md text-center">
          <Lock className="w-12 h-12 mx-auto text-primary mb-4" />
          <h1 className="text-2xl font-bold mb-2">Acesso restrito</h1>
          <p className="text-muted-foreground mb-6">Faça login para continuar.</p>
          <Link to="/auth"><Button className="grad-neon text-primary-foreground font-semibold">Entrar</Button></Link>
        </Card>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="card-elev p-8 max-w-md text-center">
          <Lock className="w-12 h-12 mx-auto text-destructive mb-4" />
          <h1 className="text-2xl font-bold mb-2">Acesso não autorizado</h1>
          <p className="text-muted-foreground mb-2">
            Seu e-mail <strong>{user.email}</strong> não está na lista de acesso.
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Solicite ao administrador para liberar seu acesso.
          </p>
          <Button variant="outline" onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}>
            Sair
          </Button>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
