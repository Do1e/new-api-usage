'use client';

import { useEffect, useState } from 'react';

import { format } from 'date-fns';
import { Archive, ArrowDownToLine, ArrowUpFromLine, Database, DollarSign, Loader2, MousePointerClick, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CHART_COLORS, formatCompactNumber, formatCurrencyAmount } from '@/lib/chart';

interface FilterState {
  startTime: number | null;
  endTime: number | null;
  user: string | null;
  model: string | null;
  token: string | null;
}

interface CallCountChartProps {
  filters: FilterState;
  refreshKey: number;
}

const METRIC_CONFIG = {
  cost: { label: '费用', icon: <DollarSign className="h-4 w-4" /> },
  calls: { label: '调用次数', icon: <MousePointerClick className="h-4 w-4" /> },
  total: { label: '总 Token', icon: <Database className="h-4 w-4" /> },
  input: { label: '输入 Token', icon: <ArrowDownToLine className="h-4 w-4" /> },
  cache: { label: '缓存 Token', icon: <Archive className="h-4 w-4" /> },
  output: { label: '输出 Token', icon: <ArrowUpFromLine className="h-4 w-4" /> },
};

type MetricKey = keyof typeof METRIC_CONFIG;

export const CallCountChart = ({ filters, refreshKey }: CallCountChartProps) => {
  const [callsData, setCallsData] = useState<Record<string, number | string>[]>([]);
  const [tokensData, setTokensData] = useState<Record<string, Record<string, number | string>[]>>({});
  const [users, setUsers] = useState<string[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<MetricKey>('cost');

  useEffect(() => {
    const fetchTimeSeries = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filters.endTime) params.append('endTime', filters.endTime.toString());
        if (filters.user) params.append('user', filters.user);
        if (filters.model) params.append('model', filters.model);
        if (filters.token) params.append('token', filters.token);

        params.append('_refresh', refreshKey.toString());
        const response = await fetch(`/api/stats/time-series?${params}`);
        if (response.ok) {
          const result = await response.json();
          setCallsData(result.data);
          setUsers(result.users);
          setTokensData({ ...(result.tokens || {}), cost: result.cost || [] });
          setCurrencySymbol(result.currencySymbol || '$');
        }
      } catch (error) {
        console.error('Failed to fetch time series:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTimeSeries();
  }, [filters, refreshKey]);

  const formatXAxis = (timestamp: number) => {
    return format(new Date(timestamp * 1000), 'MM/dd HH:mm');
  };

  const chartData = metric === 'calls' ? callsData : (tokensData[metric] || []);
  const hasData = chartData.length > 0 && users.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          {METRIC_CONFIG[metric].label}趋势（每小时）
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={metric} onValueChange={(v) => setMetric(v as MetricKey)}>
          <TabsList className="mb-4 grid h-auto w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            {(Object.keys(METRIC_CONFIG) as MetricKey[]).map((key) => (
              <TabsTrigger key={key} value={key}>
                {METRIC_CONFIG[key].icon}
                {METRIC_CONFIG[key].label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {loading && (
          <div className="h-75 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        )}
        {!loading && !hasData && (
          <div className="h-75 flex items-center justify-center text-muted-foreground">
            暂无数据
          </div>
        )}
        {!loading && hasData && (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                tickFormatter={formatXAxis}
                tick={{ fontSize: 11 }}
                interval={7}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                allowDecimals={metric === 'cost'}
                tickFormatter={(value) => (
                  metric === 'cost' ? formatCurrencyAmount(Number(value), currencySymbol) : formatCompactNumber(value)
                )}
              />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}
                labelStyle={{ color: 'var(--popover-foreground)' }}
                itemStyle={{ color: 'var(--popover-foreground)' }}
                itemSorter={(item) => {
                  const value = typeof item.value === 'number' ? item.value : Number(item.value);

                  return Number.isNaN(value) ? Number.POSITIVE_INFINITY : -value;
                }}
                labelFormatter={(label) => format(new Date(Number(label) * 1000), 'yyyy-MM-dd HH:mm')}
                formatter={(value) => {
                  const numberValue = typeof value === 'number' ? value : Number(value);

                  if (!Number.isFinite(numberValue)) {
                    return value;
                  }

                  return metric === 'cost' ? formatCurrencyAmount(numberValue, currencySymbol) : formatCompactNumber(numberValue);
                }}
              />
              <Legend />
              {users.map((username, index) => (
                <Line
                  key={username}
                  type="monotone"
                  dataKey={username}
                  stroke={CHART_COLORS[index % CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
