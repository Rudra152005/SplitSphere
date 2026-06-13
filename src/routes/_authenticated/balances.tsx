import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBalances } from "@/lib/expenses.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/balances")({
  head: () => ({ meta: [{ title: "Balances – Splitwise++" }] }),
  component: BalancesPage,
});

function BalancesPage() {
  const fn = useServerFn(getBalances);
  const { data, isLoading } = useQuery({ queryKey: ["balances"], queryFn: () => fn() });

  if (isLoading || !data) return <div className="text-muted-foreground">Computing…</div>;

  const fmt = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: data.currency, maximumFractionDigits: 2 }).format(n);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Balances</h1>
        <p className="text-muted-foreground">All amounts in {data.currency}. Settlement plan uses the minimum number of transfers.</p>
      </header>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Net balance per member</CardTitle><CardDescription>Positive = is owed; negative = owes the group.</CardDescription></CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {data.net.map((m) => (
                <li key={m.id} className="py-3 flex items-center justify-between">
                  <span className="font-medium">{m.name}</span>
                  <span className={`font-mono ${m.amount > 0.01 ? "text-green-600" : m.amount < -0.01 ? "text-red-600" : "text-muted-foreground"}`}>
                    {fmt(m.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Settle up</CardTitle><CardDescription>Minimum transfers to clear all debts.</CardDescription></CardHeader>
          <CardContent>
            {data.transfers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Everyone is settled. 🎉</p>
            ) : (
              <ul className="space-y-2">
                {data.transfers.map((t, i) => (
                  <li key={i} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{t.from}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{t.to}</span>
                    </div>
                    <span className="font-mono font-semibold">{fmt(t.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
