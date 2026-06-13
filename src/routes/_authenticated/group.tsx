import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboard } from "@/lib/expenses.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/group")({
  head: () => ({ meta: [{ title: "Group – Splitwise++" }] }),
  component: GroupPage,
});

function GroupPage() {
  const fn = useServerFn(getDashboard);
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => fn() });
  if (isLoading || !data || !data.hasGroup) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{data.group.name}</h1>
        <p className="text-muted-foreground">Base currency · {data.group.base_currency}</p>
      </header>
      <Card>
        <CardHeader><CardTitle>Members</CardTitle><CardDescription>Membership windows are honored when computing splits.</CardDescription></CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {data.members.map((m) => (
              <li key={m.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{m.display_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {m.join_date ? `joined ${m.join_date}` : "founding member"}
                    {m.leave_date ? ` · left ${m.leave_date}` : ""}
                  </div>
                </div>
                {m.is_guest && <Badge variant="outline">Guest</Badge>}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
