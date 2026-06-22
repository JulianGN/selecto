import { getDashboardData, getFlowsList } from "./actions";
import DashboardClient from "./DashboardClient";
import { Layers } from "lucide-react";

// Disable page caching so data remains in sync with the SQLite database
export const revalidate = 0;

export default async function DashboardPage() {
  const statsResult = await getDashboardData();
  const listResult = await getFlowsList();

  const stats = statsResult.stats || { totalFlows: 0, activeFlows: 0, totalSteps: 0, totalEvents: 0 };
  const flows = listResult.flows || [];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* 🚀 Main Navigation Bar */}
      <nav className="bg-card/20 border-b border-border backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-primary/10 text-primary rounded-lg border border-primary/20">
              <Layers className="w-5 h-5" />
            </span>
            <span className="font-bold tracking-tight text-slate-100">
              Selecto Control Console
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold text-muted-foreground">
            <span className="flex items-center gap-1.5 bg-secondary/60 border border-border px-3 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              API Online
            </span>
            <span className="opacity-45">v1.0.3</span>
          </div>
        </div>
      </nav>

      {/* 💻 Dashboard Content */}
      <main className="flex-1 flex flex-col">
        <DashboardClient initialFlows={flows as any} initialStats={stats} />
      </main>

      {/* 📝 Global Footer */}
      <footer className="bg-card/10 border-t border-border/40 py-6 text-center text-xs text-muted-foreground/60 mt-auto">
        <p>© {new Date().getFullYear()} Selecto Onboarding. Open Source User Walkthrough Platform.</p>
      </footer>
    </div>
  );
}
