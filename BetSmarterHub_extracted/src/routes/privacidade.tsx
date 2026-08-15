import { createFileRoute } from "@tanstack/react-router";
import { Header, ResponsibleFooter } from "@/components/Layout";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade (LGPD) — MinhaAPOSTA" },
      { name: "description", content: "Como o MinhaAPOSTA trata seus dados pessoais conforme a LGPD." },
    ],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto px-4 py-10 w-full">
        <h1 className="text-3xl font-bold mb-6 text-grad-neon">Política de Privacidade (LGPD)</h1>
        <Card className="card-elev p-6 space-y-4 text-sm leading-relaxed">
          <p><strong>1. Dados coletados.</strong> Coletamos: e-mail (autenticação), nome de exibição, foto de perfil (opcional), time favorito, histórico de palpites, XP, badges e preferências de uso.</p>
          <p><strong>2. Finalidade.</strong> Os dados são usados para autenticação, personalização da experiência (Modo Fanático), envio de notificações relevantes e gamificação (ranking, palpites).</p>
          <p><strong>3. Base legal.</strong> Tratamos seus dados com base no <strong>consentimento</strong> (cadastro) e no <strong>legítimo interesse</strong> (segurança, prevenção a fraudes).</p>
          <p><strong>4. Compartilhamento.</strong> Utilizamos como operadores: <strong>Supabase</strong> (banco de dados e autenticação), <strong>Google</strong> (login social) e provedores de odds/notícias públicas. Não vendemos seus dados.</p>
          <p><strong>5. Cookies.</strong> Usamos cookies essenciais para manter sua sessão ativa. Não utilizamos cookies de rastreamento publicitário.</p>
          <p><strong>6. Seus direitos (LGPD).</strong> Você pode a qualquer momento solicitar: acesso, correção, exclusão, portabilidade ou revogação do consentimento. Para isso, escreva para <a className="underline hover:text-primary" href="mailto:srgordo2005@gmail.com">srgordo2005@gmail.com</a>.</p>
          <p><strong>7. Retenção.</strong> Mantemos seus dados enquanto sua conta estiver ativa. Após exclusão, removemos os dados em até 30 dias, exceto quando exigido por lei.</p>
          <p><strong>8. Segurança.</strong> Aplicamos criptografia em trânsito (HTTPS) e em repouso, além de políticas de acesso (RLS) no banco.</p>
          <p><strong>9. Menores.</strong> 🔞 O serviço é proibido para menores de 18 anos. Se identificarmos cadastro de menor, removeremos imediatamente.</p>
          <p><strong>10. Encarregado (DPO).</strong> Sr. Gordo — <a className="underline hover:text-primary" href="mailto:srgordo2005@gmail.com">srgordo2005@gmail.com</a></p>
          <p className="text-muted-foreground pt-4">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>
        </Card>
      </main>
      <ResponsibleFooter />
    </div>
  );
}
