import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Wallet, Upload, Scale, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Splitwise++ – Shared expenses with auditable imports" },
      { name: "description", content: "Import messy expense spreadsheets, surface every anomaly, and settle group debts with the minimum number of transfers." },
      { property: "og:title", content: "Splitwise++ – Shared expenses, fully auditable" },
      { property: "og:description", content: "Anomaly-aware CSV import, multi-currency support, and minimum-transfer debt settlement." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <header className="px-6 py-5 max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary font-semibold">
          <Wallet className="h-6 w-6" /> Splitwise++
        </div>
        <Link to="/auth"><Button>Sign in</Button></Link>
      </header>
      <main className="max-w-6xl mx-auto px-6 pt-12 pb-24">
        <section className="text-center max-w-3xl mx-auto">
          <p className="text-sm uppercase tracking-widest text-muted-foreground">Production-grade shared expenses</p>
          <h1 className="mt-4 text-4xl md:text-5xl font-bold tracking-tight">
            Import messy spreadsheets.<br />Settle debts in the minimum transfers.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Every anomaly is surfaced, every action is auditable, and nothing is silently mutated. Built for the Spreetail assignment.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <Link to="/auth"><Button size="lg">Open the app</Button></Link>
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-6 mt-20">
          {[
            { icon: Upload, title: "Anomaly-aware import", body: "Duplicates, bad dates, missing payers, settlements masquerading as expenses — caught and reported, never silently fixed." },
            { icon: Scale, title: "Debt minimization", body: "Member balances are reduced to the smallest set of transfers using a greedy matching algorithm." },
            { icon: ShieldCheck, title: "Full audit log", body: "Every import, approval, expense, and settlement is timestamped with before/after snapshots." },
          ].map((f) => (
            <div key={f.title} className="p-6 rounded-lg border border-border bg-card">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
