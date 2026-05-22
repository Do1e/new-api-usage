import DashboardClient from '@/components/dashboard/dashboard-client';
import { getDefaultRecentDays } from '@/lib/env';

const DashboardPage = () => {
  const defaultRecentDays = getDefaultRecentDays();

  return <DashboardClient defaultRecentDays={defaultRecentDays} />;
};

export default DashboardPage;
