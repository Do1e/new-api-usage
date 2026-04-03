'use client';

import { useEffect, useState } from 'react';

import { Database, Loader2, MousePointerClick } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface FilterState {
  startTime: number | null;
  endTime: number | null;
  user: string | null;
  model: string | null;
}

interface ModelPieChartsProps {
  filters: FilterState;
  refreshKey: number;
}

interface ModelData {
  model: string;
  calls: number;
  totalTokens: number;
}

interface PieData {
  name: string;
  value: number;
}

const COLORS = [
  '#3b82f6', '#10b981', '#f97316', '#8b5cf6', '#ec4899',
  '#14b8a6', '#f59e0b', '#6366f1', '#ef4444', '#84cc16',
];

export const ModelPieCharts = ({ filters, refreshKey }: ModelPieChartsProps) => {
  const [callData, setCallData] = useState<PieData[]>([]);
  const [tokenData, setTokenData] = useState<PieData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchModelStats = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filters.startTime) params.append('startTime', filters.startTime.toString());
        if (filters.endTime) params.append('endTime', filters.endTime.toString());
        if (filters.user) params.append('user', filters.user);

        const response = await fetch(`/api/stats/models?${params}`);
        if (response.ok) {
          const result = await response.json();
          const models: ModelData[] = result.data;

          // Prepare calls pie data
          const callsPieData = models
            .filter((m) => m.calls > 0)
            .map((m) => ({
              name: m.model,
              value: m.calls,
            }));

          // Prepare tokens pie data
          const tokensPieData = models
            .filter((m) => m.totalTokens > 0)
            .map((m) => ({
              name: m.model,
              value: m.totalTokens,
            }));

          setCallData(callsPieData);
          setTokenData(tokensPieData);
        }
      } catch (error) {
        console.error('Failed to fetch model stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchModelStats();
  }, [filters, refreshKey]);

  const formatNumber = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)  }M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)  }K`;
    return value.toString();
  };

  const renderPieChart = (data: PieData[], unit: string) => {
    if (loading) {
      return (
        <div className="h-62.5 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      );
    }
    if (data.length === 0) {
      return (
        <div className="h-62.5 flex items-center justify-center text-muted-foreground text-sm">
          暂无数据
        </div>
      );
    }
    return (
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) =>
              `${name}: ${((percent || 0) * 100).toFixed(0)}%`
            }
            outerRadius={70}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry) => (
              <Cell key={`cell-${entry.name}`} fill={COLORS[data.indexOf(entry) % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}
            labelStyle={{ color: 'var(--popover-foreground)' }}
            itemStyle={{ color: 'var(--popover-foreground)' }}
            formatter={(value) => [formatNumber(Number(value)), unit === 'Calls' ? '调用' : 'Token']}
          />
          <Legend fontSize={12} />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MousePointerClick className="h-5 w-5" />
            模型调用分布
          </CardTitle>
        </CardHeader>
        <CardContent>
          {renderPieChart(callData, 'Calls')}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="h-5 w-5" />
            模型 Token 分布
          </CardTitle>
        </CardHeader>
        <CardContent>
          {renderPieChart(tokenData, 'Tokens')}
        </CardContent>
      </Card>
    </>
  );
}
