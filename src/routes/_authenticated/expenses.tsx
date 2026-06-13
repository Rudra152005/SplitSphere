import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listExpenses } from "@/lib/expenses.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({ meta: [{ title: "Expenses – Splitwise++" }] }),
  component: ExpensesPage,
});

function ExpensesPage() {
  const fn = useServerFn(listExpenses);
  const { data, isLoading } = useQuery({ queryKey: ["expenses"], queryFn: () => fn() });

  if (isLoading || !data) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Expenses & Settlements</h1>
        <p className="text-muted-foreground">{data.expenses.length} expenses · {(data as any).settlements?.length ?? 0} settlements</p>
      </header>

      <Card>
        <CardHeader><CardTitle>Expenses</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                <th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Description</th><th className="py-2 pr-3">Paid by</th><th className="py-2 pr-3 text-right">Original</th><th className="py-2 pr-3 text-right">Base (INR)</th><th className="py-2 pr-3">Split</th><th className="py-2 pr-3">Shares</th>
              </tr>
            </thead>
            <tbody>
              {data.expenses.map((e) => (
                <tr key={e.id} className="border-b border-border/60 align-top">
                  <td className="py-2 pr-3 font-mono text-xs">{e.date}</td>
                  <td className="py-2 pr-3">{e.description}{e.notes && <div className="text-xs text-muted-foreground">{e.notes}</div>}</td>
                  <td className="py-2 pr-3">{e.paid_by_name ?? "—"}</td>
                  <td className="py-2 pr-3 text-right font-mono">{Number(e.amount_original)} {e.currency}</td>
                  <td className="py-2 pr-3 text-right font-mono">{Number(e.amount_base).toFixed(2)}</td>
                  <td className="py-2 pr-3"><Badge variant="outline" className="text-xs">{e.split_type}</Badge></td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground">
                    {e.splits.map((s, i) => <div key={i}>{s.member}: {s.amount.toFixed(2)}</div>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {(data as any).settlements?.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Settlements</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                <th className="py-2 pr-3">Date</th><th className="py-2 pr-3">From</th><th className="py-2 pr-3">To</th><th className="py-2 pr-3 text-right">Amount</th><th className="py-2 pr-3">Notes</th>
              </tr></thead>
              <tbody>
                {(data as any).settlements.map((s: any) => (
                  <tr key={s.id} className="border-b border-border/60">
                    <td className="py-2 pr-3 font-mono text-xs">{s.date}</td>
                    <td className="py-2 pr-3">{s.from_name}</td>
                    <td className="py-2 pr-3">{s.to_name}</td>
                    <td className="py-2 pr-3 text-right font-mono">{Number(s.amount)} {s.currency}</td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{s.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
