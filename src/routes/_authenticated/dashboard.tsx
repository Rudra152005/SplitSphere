import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { bootstrapDefaultGroup, getDashboard } from "@/lib/expenses.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEffect } from "react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Wallet, Users, ArrowRightLeft, Receipt } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard – Splitwise++" }] }),
  component: Dashboard,
});

const fmt = (n: number, ccy = "INR") =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: ccy, maximumFractionDigits: 0 }).format(n);

function Dashboard() {
  const qc = useQueryClient();
  const fetchDash = useServerFn(getDashboard);
  const bootstrap = useServerFn(bootstrapDefaultGroup);

  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => fetchDash() });
  const bootstrapMut = useMutation({
    mutationFn: () => bootstrap(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dashboard"] }),
  });

  useEffect(() => {
    if (!isLoading && data && !data.hasGroup && !bootstrapMut.isPending) bootstrapMut.mutate();
  }, [isLoading, data, bootstrapMut]);

  if (isLoading || !data || !data.hasGroup) {
    return <div className="text-muted-foreground">Setting up your workspace…</div>;
  }

  const colors = ["hsl(var(--primary))", "#16a34a", "#ea580c", "#7c3aed", "#0891b2"];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{data.group.name}</h1>
          <p className="text-muted-foreground">Base currency · {data.group.base_currency}</p>
        </div>
        <Link to="/import"><Button>Import CSV</Button></Link>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Receipt} label="Total expenses" value={fmt(data.stats.totalSpend)} />
        <StatCard icon={ArrowRightLeft} label="Settled" value={fmt(data.stats.totalSettled)} />
        <StatCard icon={Wallet} label="Transactions" value={String(data.stats.expenseCount)} />
        <StatCard icon={Users} label="Active members" value={String(data.stats.activeMembers)} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Monthly spending</CardTitle></CardHeader>
          <CardContent className="h-72">
            {data.trend.length === 0 ? (
              <div className="h-full grid place-items-center text-muted-foreground text-sm">No expenses yet — import the CSV.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.trend}>
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip formatter={(v) => fmt(Number(v))} />
                  <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>By currency</CardTitle></CardHeader>
          <CardContent className="h-72">
            {data.currencyDist.length === 0 ? (
              <div className="h-full grid place-items-center text-muted-foreground text-sm">No expenses yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.currencyDist} dataKey="amount" nameKey="currency" innerRadius={50} outerRadius={90} label>
                    {data.currencyDist.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent imports</CardTitle></CardHeader>
        <CardContent>
          {data.batches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No imports yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.batches.map((b) => (
                <li key={b.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-sm">{b.filename}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(b.created_at).toLocaleString()} · {b.imported_rows}/{b.total_rows} imported
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {b.anomaly_count > 0 && <Badge variant="outline">{b.anomaly_count} anomalies</Badge>}
                    <Badge>{b.status}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Wallet; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="mt-2 text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
