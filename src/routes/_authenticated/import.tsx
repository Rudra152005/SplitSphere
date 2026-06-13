import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { bootstrapDefaultGroup } from "@/lib/expenses.functions";
import { validateCsv, commitImport } from "@/lib/csv-import.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileCheck2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { Anomaly, ParsedExpense } from "@/lib/anomaly-detector";

export const Route = createFileRoute("/_authenticated/import")({
  head: () => ({ meta: [{ title: "Import CSV – Splitwise++" }] }),
  component: ImportPage,
});

type ValidateResult = {
  batchId: string;
  parsed: ParsedExpense[];
  anomalies: Anomaly[];
  totalRows: number;
};

const severityColor: Record<Anomaly["severity"], string> = {
  info: "bg-muted text-muted-foreground",
  warning: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  error: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
};

function ImportPage() {
  const qc = useQueryClient();
  const fnValidate = useServerFn(validateCsv);
  const fnCommit = useServerFn(commitImport);
  const fnBootstrap = useServerFn(bootstrapDefaultGroup);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [filename, setFilename] = useState("");
  const [result, setResult] = useState<ValidateResult | null>(null);
  const [actions, setActions] = useState<Record<string, "import" | "skip">>({});
  const [committed, setCommitted] = useState<{ imported: number; skipped: number; settlementsCreated: number } | null>(null);

  const validateMut = useMutation({
    mutationFn: async (csvText: string) => {
      // ensure group exists
      await fnBootstrap();
      return fnValidate({ data: { csvText, filename } }) as Promise<ValidateResult>;
    },
    onSuccess: (r) => { setResult(r); setStep(3); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "validation failed"),
  });
  const commitMut = useMutation({
    mutationFn: () => fnCommit({ data: { batchId: result!.batchId, approvedActions: actions } }),
    onSuccess: (r) => {
      setCommitted(r);
      setStep(4);
      qc.invalidateQueries();
      toast.success(`Imported ${r.imported + r.settlementsCreated} rows`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "commit failed"),
  });

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFilename(f.name);
    const text = await f.text();
    setStep(2);
    validateMut.mutate(text);
  }

  const stats = result ? {
    errors: result.anomalies.filter((a) => a.severity === "error").length,
    warnings: result.anomalies.filter((a) => a.severity === "warning").length,
    info: result.anomalies.filter((a) => a.severity === "info").length,
    duplicates: result.parsed.filter((p) => p.duplicateOf).length,
    settlements: result.parsed.filter((p) => p.classification === "settlement").length,
  } : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Import CSV</h1>
        <p className="text-muted-foreground">Six-step wizard with full anomaly review before anything is written.</p>
      </header>

      <div className="flex gap-2 text-xs">
        {["Upload", "Validate", "Review", "Done"].map((s, i) => (
          <Badge key={s} variant={step > i ? "default" : step === i + 1 ? "default" : "outline"}>
            {i + 1}. {s}
          </Badge>
        ))}
      </div>

      {step === 1 && (
        <Card>
          <CardHeader><CardTitle>Upload your CSV</CardTitle><CardDescription>The sample expenses_export.csv from the assignment works as-is.</CardDescription></CardHeader>
          <CardContent>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-12 cursor-pointer hover:bg-muted/50 transition-colors">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="mt-3 font-medium">Click to choose a CSV file</span>
              <span className="text-xs text-muted-foreground mt-1">Headers expected: date, description, paid_by, amount, currency, split_type, split_with, split_details, notes</span>
              <input type="file" accept=".csv" className="hidden" onChange={onFile} />
            </label>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card><CardContent className="p-12 text-center text-muted-foreground">Parsing and validating <strong>{filename}</strong>…</CardContent></Card>
      )}

      {step === 3 && result && stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Stat label="Rows" value={result.totalRows} />
            <Stat label="Errors" value={stats.errors} tone="error" />
            <Stat label="Warnings" value={stats.warnings} tone="warn" />
            <Stat label="Duplicates" value={stats.duplicates} />
            <Stat label="Settlements" value={stats.settlements} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" />Anomaly report</CardTitle>
              <CardDescription>Every issue, the recommendation, and the action the importer will take. Rows with errors are skipped by default — toggle to override.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-3">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                      <th className="py-2 pr-2">Row</th>
                      <th className="py-2 pr-2">Severity</th>
                      <th className="py-2 pr-2">Type</th>
                      <th className="py-2 pr-2">Message</th>
                      <th className="py-2 pr-2">Action taken</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.anomalies.map((a, i) => (
                      <tr key={i} className="border-b border-border/60 align-top">
                        <td className="py-2 pr-2 font-mono text-xs">{a.rowNumber}</td>
                        <td className="py-2 pr-2"><span className={`px-2 py-0.5 rounded text-xs ${severityColor[a.severity]}`}>{a.severity}</span></td>
                        <td className="py-2 pr-2 text-xs">{a.type}</td>
                        <td className="py-2 pr-2">{a.message}<div className="text-xs text-muted-foreground mt-0.5">{a.recommendation}</div></td>
                        <td className="py-2 pr-2 text-xs">{a.actionTaken}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Row decisions</CardTitle>
              <CardDescription>Override per-row what the importer will do.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] pr-3">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                      <th className="py-2 pr-2">Row</th><th className="py-2 pr-2">Date</th><th className="py-2 pr-2">Description</th><th className="py-2 pr-2">Payer</th><th className="py-2 pr-2 text-right">Amount</th><th className="py-2 pr-2">Class</th><th className="py-2 pr-2">Decision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.parsed.map((p) => (
                      <tr key={p.rowNumber} className="border-b border-border/60">
                        <td className="py-1.5 pr-2 font-mono text-xs">{p.rowNumber}</td>
                        <td className="py-1.5 pr-2 text-xs">{p.date ?? "?"}</td>
                        <td className="py-1.5 pr-2">{p.description}</td>
                        <td className="py-1.5 pr-2 text-xs">{p.paidBy ?? "—"}</td>
                        <td className="py-1.5 pr-2 text-right">{p.amount !== null ? `${p.amount} ${p.currency ?? ""}` : "—"}</td>
                        <td className="py-1.5 pr-2"><Badge variant="outline" className="text-xs">{p.classification}</Badge></td>
                        <td className="py-1.5 pr-2">
                          <select
                            value={actions[p.rowNumber] ?? (p.classification === "skip" ? "skip" : "import")}
                            onChange={(e) => setActions({ ...actions, [p.rowNumber]: e.target.value as "import" | "skip" })}
                            className="text-xs border rounded px-1 py-0.5 bg-background"
                          >
                            <option value="import">import</option>
                            <option value="skip">skip</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setStep(1); setResult(null); setActions({}); }}>Start over</Button>
            <Button onClick={() => commitMut.mutate()} disabled={commitMut.isPending}>
              {commitMut.isPending ? "Committing…" : "Commit import"}
            </Button>
          </div>
        </>
      )}

      {step === 4 && committed && (
        <Card>
          <CardContent className="p-10 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <h2 className="text-xl font-semibold">Import complete</h2>
            <p className="text-muted-foreground text-sm">
              {committed.imported} expenses + {committed.settlementsCreated} settlements created · {committed.skipped} rows skipped.
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => { setStep(1); setResult(null); setCommitted(null); setActions({}); }}>Import another</Button>
              <Button variant="outline" asChild><a href="/balances">View balances</a></Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "error" | "warn" }) {
  const color = tone === "error" ? "text-red-600" : tone === "warn" ? "text-amber-600" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className={`mt-1 text-2xl font-bold ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
