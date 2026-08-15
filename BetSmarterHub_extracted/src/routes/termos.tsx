import { createFileRoute } from "@tanstack/react-router";
import { Header, ResponsibleFooter } from "@/components/Layout";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — MinhaAPOSTA" },
      { name: "description", content: "Termos de uso da plataforma informativa MinhaAPOSTA." },
    ],
  }),
  component: TermosPage,
});

function TermosPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto px-4 py-10 w-full">
        <h1 className="text-3xl font-bold mb-6 text-grad-neon">Termos de Uso</h1>
        <Card className="card-elev p-6 space-y-4 text-sm leading-relaxed">
          <p><strong>1. Natureza do serviço.</strong> O MinhaAPOSTA é uma <strong>ferramenta informativa e educacional</strong>. Não somos uma casa de apostas, não aceitamos depósitos, não pagamos prêmios e não intermediamos qualquer aposta.</p>
          <p><strong>2. Idade mínima.</strong> 🔞 O uso é proibido para menores de 18 anos. Ao acessar, você declara ser maior de idade.</p>
          <p><strong>3. Odds e dados.</strong> As odds, estatísticas e análises exibidas têm caráter meramente comparativo. Verifique sempre diretamente nas casas de apostas autorizadas pela SPA/Ministério da Fazenda antes de qualquer decisão.</p>
          <p><strong>4. Palpites e XP.</strong> Pontos, níveis, badges e palpites são <strong>fins de entretenimento</strong> e não possuem valor monetário, não podem ser convertidos em dinheiro nem em prêmios.</p>
          <p><strong>5. Responsabilidade do usuário.</strong> Você é o único responsável por suas decisões de apostas. O MinhaAPOSTA não se responsabiliza por perdas financeiras decorrentes de uso de informações do site.</p>
          <p><strong>6. Conduta no chat.</strong> É proibido spam, conteúdo adulto, discurso de ódio, violência e divulgação de dados pessoais. Reservamo-nos o direito de suspender contas que violem essas regras.</p>
          <p><strong>7. Calculadora de Dutching.</strong> Trata-se de ferramenta matemática educacional. Resultados são estimativas e podem variar. Apostas em múltiplos bookmakers podem violar termos das plataformas — verifique antes.</p>
          <p><strong>8. Afiliação.</strong> Eventuais links para casas de apostas seguem a Lei nº 14.790/2023 e referem-se apenas a operadores autorizados. A relação comercial não compromete a imparcialidade editorial.</p>
          <p><strong>9. Jogo responsável.</strong> Aposte apenas o que pode perder. Em caso de dificuldades, ligue 188 (CVV, 24h) ou acesse cvv.org.br.</p>
          <p><strong>10. Alterações.</strong> Estes termos podem ser atualizados a qualquer momento. O uso contínuo após mudanças implica aceitação.</p>
          <p className="text-muted-foreground pt-4">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>
        </Card>
      </main>
      <ResponsibleFooter />
    </div>
  );
}
