import { getDashboardData, getFlowsList } from "./actions";
import DashboardClient, { Flow } from "./DashboardClient";

// Disable page caching so data remains in sync with the SQLite database
export const revalidate = 0;

export default async function DashboardPage() {
  const statsResult = await getDashboardData();
  const listResult = await getFlowsList();

  const stats = statsResult.stats || { totalFlows: 0, activeFlows: 0, totalSteps: 0, totalEvents: 0 };
  const flows = listResult.flows || [];

  return (
    <DashboardClient initialFlows={flows as unknown as Flow[]} initialStats={stats} />
  );
}
