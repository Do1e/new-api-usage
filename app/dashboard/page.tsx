import DashboardClient from '@/components/dashboard/dashboard-client';
import { getDefaultRecentDays } from '@/lib/env';

export const dynamic = 'force-dynamic';

const DashboardPage = () => {
  const defaultRecentDays = getDefaultRecentDays();

  return <DashboardClient defaultRecentDays={defaultRecentDays} />;
};

export default DashboardPage;
