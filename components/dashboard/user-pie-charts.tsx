'use client';

import { useEffect, useState } from 'react';

import { Loader2, PieChart as PieChartIcon, MousePointerClick, Database, ArrowDownToLine, Archive, ArrowUpFromLine } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createPieLabelRenderer, formatPieValue, PieTooltipContent, PIE_CHART_COLORS } from '@/lib/pie-chart';

interface FilterState {
  startTime: number | null;
  endTime: number | null;
  user: string | null;
  model: string | null;
  token: string | null;
}

interface UserPieChartsProps {
  filters: FilterState;
  refreshKey: number;
}

interface UserData {
  username: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
  totalTokens: number;
}

interface PieData {
  name: string;
  value: number;
}
const renderLabel = createPieLabelRenderer();

type TabType = 'calls' | 'totalTokens' | 'inputTokens' | 'cacheTokens' | 'outputTokens';

const TAB_CONFIG: Record<TabType, { label: string; icon: React.ReactNode; unit: string }> = {
  calls: { label: '调用', icon: <MousePointerClick className="h-4 w-4" />, unit: '调用' },
  totalTokens: { label: '总Token', icon: <Database className="h-4 w-4" />, unit: 'Token' },
  inputTokens: { label: '输入', icon: <ArrowDownToLine className="h-4 w-4" />, unit: 'Token' },
  cacheTokens: { label: '缓存', icon: <Archive className="h-4 w-4" />, unit: 'Token' },
  outputTokens: { label: '输出', icon: <ArrowUpFromLine className="h-4 w-4" />, unit: 'Token' },
};

export const UserPieCharts = ({ filters, refreshKey }: UserPieChartsProps) => {
  const [userData, setUserData] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('calls');

  useEffect(() => {
    const fetchUserStats = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filters.startTime) params.append('startTime', filters.startTime.toString());
        if (filters.endTime) params.append('endTime', filters.endTime.toString());
        if (filters.model) params.append('model', filters.model);
        if (filters.token) params.append('token', filters.token);
        if (filters.user) params.append('user', filters.user);

        const response = await fetch(`/api/stats/users?${params}`);
        if (response.ok) {
          const result = await response.json();
          setUserData(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch user stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserStats();
  }, [filters, refreshKey]);

  const preparePieData = (dataKey: TabType): PieData[] => {
    return userData
      .filter((u) => u[dataKey] > 0)
      .slice(0, 10) // Top 10 users
      .map((u) => ({
        name: u.username,
        value: u[dataKey],
      }));
  };

  const renderPieChart = (dataKey: TabType) => {
    const data = preparePieData(dataKey);
    const total = data.reduce((sum, item) => sum + item.value, 0);

    if (loading) {
      return (
        <div className="h-75 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }
    if (data.length === 0) {
      return (
        <div className="h-75 flex items-center justify-center text-muted-foreground">
          暂无数据
        </div>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderLabel}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${dataKey}-${entry.name}`} fill={PIE_CHART_COLORS[index % PIE_CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={(props) => <PieTooltipContent {...props} formatValue={formatPieValue} total={total} unit={TAB_CONFIG[dataKey].unit} />} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <PieChartIcon className="h-5 w-5" />
          用户分布
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
          <TabsList className="grid grid-cols-5 w-full">
            {(Object.keys(TAB_CONFIG) as TabType[]).map((key) => (
              <TabsTrigger key={key} value={key} className="flex items-center gap-1 text-xs">
                {TAB_CONFIG[key].icon}
                <span className="hidden sm:inline">{TAB_CONFIG[key].label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="calls" className="mt-4">
            {renderPieChart('calls')}
          </TabsContent>
          <TabsContent value="totalTokens" className="mt-4">
            {renderPieChart('totalTokens')}
          </TabsContent>
          <TabsContent value="inputTokens" className="mt-4">
            {renderPieChart('inputTokens')}
          </TabsContent>
          <TabsContent value="cacheTokens" className="mt-4">
            {renderPieChart('cacheTokens')}
          </TabsContent>
          <TabsContent value="outputTokens" className="mt-4">
            {renderPieChart('outputTokens')}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
