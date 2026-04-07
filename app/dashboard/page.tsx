'use client';

import { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';

import { Loader2 } from 'lucide-react';

import { CallCountChart } from '@/components/dashboard/call-count-chart';
import { Filters } from '@/components/dashboard/filters';
import { LogsTable } from '@/components/dashboard/logs-table';
import { ModelPieCharts } from '@/components/dashboard/model-pie-charts';
import { SummaryCards } from '@/components/dashboard/summary-cards';
import { TokenPieChart } from '@/components/dashboard/token-pie-chart';
import { UserPieCharts } from '@/components/dashboard/user-pie-charts';
import { ThemeToggle } from '@/components/theme-toggle';

interface FilterState {
  startTime: number | null;
  endTime: number | null;
  user: string | null;
  model: string | null;
  token: string | null;
}

const DashboardPage = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>({
    startTime: null,
    endTime: null,
    user: null,
    model: null,
    token: null,
  });
  const [refreshKey, setRefreshKey] = useState(0);

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/check');
        if (!response.ok) {
          router.push('/login');
        } else {
          setLoading(false);
        }
      } catch {
        router.push('/login');
      }
    };
    checkAuth();
  }, [router]);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">
            API 用量仪表板
          </h1>
          <ThemeToggle />
        </div>

        <Filters
          filters={filters}
          onFiltersChange={setFilters}
          onRefresh={handleRefresh}
        />

        <SummaryCards
          filters={filters}
          refreshKey={refreshKey}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TokenPieChart
            filters={filters}
            refreshKey={refreshKey}
          />

          {!filters.user && (
            <UserPieCharts
              filters={filters}
              refreshKey={refreshKey}
            />
          )}
        </div>

        {!filters.model && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ModelPieCharts
              filters={filters}
              refreshKey={refreshKey}
            />
          </div>
        )}

        <CallCountChart
          filters={filters}
          refreshKey={refreshKey}
        />

        <LogsTable
          filters={filters}
          refreshKey={refreshKey}
        />
      </div>
    </div>
  );
};

export default DashboardPage;
