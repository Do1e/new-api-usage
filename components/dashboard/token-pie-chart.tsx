'use client';

import { useEffect, useState } from 'react';

import { Loader2, PieChart as PieChartIcon } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createPieLabelRenderer, formatPieValue, PieTooltipContent } from '@/lib/pie-chart';

interface FilterState {
  startTime: number | null;
  endTime: number | null;
  user: string | null;
  model: string | null;
  token: string | null;
}

interface TokenPieChartProps {
  filters: FilterState;
  refreshKey: number;
}

interface PieData {
  name: string;
  value: number;
  color: string;
}

const COLORS = ['#10b981', '#f97316', '#8b5cf6'];
const renderLabel = createPieLabelRenderer(1);

export const TokenPieChart = ({ filters, refreshKey }: TokenPieChartProps) => {
  const [data, setData] = useState<PieData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filters.startTime) params.append('startTime', filters.startTime.toString());
        if (filters.endTime) params.append('endTime', filters.endTime.toString());
        if (filters.user) params.append('user', filters.user);
        if (filters.model) params.append('model', filters.model);
        if (filters.token) params.append('token', filters.token);

        const response = await fetch(`/api/stats/summary?${params}`);
        if (response.ok) {
          const stats = await response.json();

          const nonCacheInput = Math.max(0, stats.inputTokens - stats.cacheTokens);

          const pieData: PieData[] = [
            { name: '非缓存输入', value: nonCacheInput, color: COLORS[0] },
            { name: '输出', value: stats.outputTokens, color: COLORS[1] },
            { name: '缓存', value: stats.cacheTokens, color: COLORS[2] },
          ].filter((item) => item.value > 0);

          setData(pieData);
        }
      } catch (error) {
        console.error('Failed to fetch token stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [filters, refreshKey]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
          <PieChartIcon className="h-5 w-5" />
          Token分布
        </CardTitle>
      </CardHeader>
      <CardContent>
        {(() => {
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
          const total = data.reduce((sum, item) => sum + item.value, 0);

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
                  {data.map((entry) => (
                    <Cell key={`cell-${entry.name}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={(props) => <PieTooltipContent {...props} formatValue={formatPieValue} total={total} unit="Tokens" />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          );
        })()}
      </CardContent>
    </Card>
  );
};
