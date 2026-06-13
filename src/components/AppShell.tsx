import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Wallet, LayoutDashboard, Upload, Scale, Receipt, FileClock, LogOut, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useServerFn } from "@tanstack/react-start";
import { logoutUser } from "@/lib/auth.functions";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/expenses", label: "Expenses", icon: Receipt },
  { to: "/balances", label: "Balances", icon: Scale },
  { to: "/import", label: "Import CSV", icon: Upload },
  { to: "/group", label: "Group", icon: Users },
  { to: "/audit", label: "Audit log", icon: FileClock },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const logout = useServerFn(logoutUser);

  async function signOut() {
    await logout();
    window.location.href = "/auth";
  }

  return (
    <div className="min-h-screen bg-muted/20 flex">
      <aside className="hidden md:flex w-64 flex-col bg-card border-r border-border">
        <div className="px-6 py-5 flex items-center gap-2 text-primary">
          <Wallet className="h-6 w-6" />
          <span className="font-semibold tracking-tight">Splitwise++</span>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {nav.map((n) => {
            const active = pathname === n.to;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border">
          <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start gap-2">
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <div className="md:hidden border-b border-border bg-card px-4 py-3 flex items-center justify-between">
          <span className="font-semibold flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" />Splitwise++</span>
          <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
        </div>
        <div className="md:hidden flex overflow-x-auto gap-1 px-3 py-2 bg-card border-b border-border">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} className={cn(
              "text-xs whitespace-nowrap px-3 py-1.5 rounded-full",
              pathname === n.to ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>{n.label}</Link>
          ))}
        </div>
        <div className="p-6 md:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
