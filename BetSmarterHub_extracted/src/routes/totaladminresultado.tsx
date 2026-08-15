import { createFileRoute, Link } from "@tanstack/react-router";
import { Header, ResponsibleFooter } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAccess } from "@/hooks/useAccess";
import { Lock, TrendingUp, Activity, DollarSign } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, CartesianGrid } from "recharts";

export const Route = createFileRoute("/totaladminresultado")({ component: TotalAdminResultado });

const apiHealth = [
  { day: "Seg", "API-Football": 99.8, "Odds API": 99.2, "OpenRouter": 99.9 },
  { day: "Ter", "API-Football": 99.5, "Odds API": 98.7, "OpenRouter": 99.7 },
  { day: "Qua", "API-Football": 99.9, "Odds API": 99.5, "OpenRouter": 99.8 },
  { day: "Qui", "API-Football": 99.3, "Odds API": 99.0, "OpenRouter": 99.6 },
  { day: "Sex", "API-Football": 99.7, "Odds API": 99.4, "OpenRouter": 99.9 },
  { day: "Sáb", "API-Football": 99.9, "Odds API": 99.8, "OpenRouter": 99.9 },
  { day: "Dom", "API-Football": 99.6, "Odds API": 99.1, "OpenRouter": 99.7 },
];

const finance = [
  { mes: "Jun", receita: 12400, custo: 4800, lucro: 7600 },
  { mes: "Jul", receita: 15200, custo: 5100, lucro: 10100 },
  { mes: "Ago", receita: 18900, custo: 5400, lucro: 13500 },
  { mes: "Set", receita: 22300, custo: 6200, lucro: 16100 },
  { mes: "Out", receita: 26800, custo: 6800, lucro: 20000 },
  { mes: "Nov", receita: 31200, custo: 7400, lucro: 23800 },
];

const expenses = [
  { item: "API-Football", valor: 2400 },
  { item: "Odds API",     valor: 1800 },
  { item: "OpenRouter",   valor: 1200 },
  { item: "IPTV partner", valor: 1500 },
  { item: "Infra/CDN",    valor: 500 },
];

function TotalAdminResultado() {
  const { user, isAdmin, loading } = useAccess();

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="card-elev p-8 max-w-md text-center">
          <Lock className="w-12 h-12 mx-auto text-destructive mb-4" />
          <h1 className="text-2xl font-bold mb-2">Acesso restrito</h1>
          <p className="text-muted-foreground mb-4">Apenas administradores.</p>
          <Link to="/"><Button>Voltar</Button></Link>
        </Card>
      </div>
    );
  }

  const totalReceita = finance.reduce((s, f) => s + f.receita, 0);
  const totalLucro = finance.reduce((s, f) => s + f.lucro, 0);
  const totalCusto = finance.reduce((s, f) => s + f.custo, 0);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto px-4 py-10 w-full">
        <h1 className="text-3xl font-bold mb-2">TOTALADMINRESULTADO</h1>
        <p className="text-muted-foreground mb-8">Visão financeira e operacional. Dados mock — depois conectar à base real.</p>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <Card className="card-elev p-5">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><DollarSign className="w-4 h-4" /> Receita 6m</div>
            <p className="text-2xl font-bold font-mono mt-1">R$ {totalReceita.toLocaleString("pt-BR")}</p>
          </Card>
          <Card className="card-elev p-5">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><TrendingUp className="w-4 h-4" /> Lucro 6m</div>
            <p className="text-2xl font-bold font-mono mt-1 text-success">R$ {totalLucro.toLocaleString("pt-BR")}</p>
          </Card>
          <Card className="card-elev p-5">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><Activity className="w-4 h-4" /> Custo 6m</div>
            <p className="text-2xl font-bold font-mono mt-1 text-destructive">R$ {totalCusto.toLocaleString("pt-BR")}</p>
          </Card>
        </div>

        <Card className="card-elev p-5 mb-6">
          <h2 className="font-bold mb-3">Receita vs Lucro vs Custo</h2>
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={finance}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="receita" stroke="oklch(0.62 0.18 220)" strokeWidth={2} />
                <Line type="monotone" dataKey="lucro"   stroke="oklch(0.66 0.18 155)" strokeWidth={2} />
                <Line type="monotone" dataKey="custo"   stroke="oklch(0.62 0.24 25)"  strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="card-elev p-5">
            <h2 className="font-bold mb-3">Saúde das APIs (uptime %)</h2>
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={apiHealth}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="day" />
                  <YAxis domain={[98, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="API-Football" stroke="oklch(0.62 0.18 220)" />
                  <Line type="monotone" dataKey="Odds API"     stroke="oklch(0.78 0.14 305)" />
                  <Line type="monotone" dataKey="OpenRouter"   stroke="oklch(0.66 0.18 155)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="card-elev p-5">
            <h2 className="font-bold mb-3">Despesas por item (mês atual)</h2>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={expenses}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="item" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="valor" fill="oklch(0.62 0.18 220)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </main>
      <ResponsibleFooter />
    </div>
  );
}
