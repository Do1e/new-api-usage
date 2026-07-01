'use client';

import { useEffect, useState } from 'react';

import { Database, DollarSign, Loader2, MousePointerClick, PieChart as PieChartIcon } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrencyAmount } from '@/lib/chart';
import { createPieLabelRenderer, formatPieValue, PieTooltipContent, PIE_CHART_COLORS } from '@/lib/pie-chart';

interface FilterState {
  startTime: number | null;
  endTime: number | null;
  user: string | null;
  model: string | null;
  token: string | null;
}

interface ModelPieChartsProps {
  filters: FilterState;
  refreshKey: number;
}

interface ModelData {
  model: string;
  calls: number;
  totalTokens: number;
  cost: number;
}

interface SummaryStats {
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
}

interface PieData {
  name: string;
  value: number;
}

const renderLabel = createPieLabelRenderer();
const tokenRenderLabel = createPieLabelRenderer(1);

type TabType = 'modelCost' | 'tokenDistribution' | 'modelCalls' | 'modelTokens';

const TAB_CONFIG: Record<TabType, { icon: React.ReactNode; label: string; unit: string }> = {
  modelCost: { label: '模型费用', icon: <DollarSign className="h-4 w-4" />, unit: '' },
  modelCalls: { label: '模型调用', icon: <MousePointerClick className="h-4 w-4" />, unit: '调用' },
  modelTokens: { label: '模型Token', icon: <Database className="h-4 w-4" />, unit: 'Token' },
  tokenDistribution: { label: 'Token类型', icon: <PieChartIcon className="h-4 w-4" />, unit: 'Token' },
};

export const ModelPieCharts = ({ filters, refreshKey }: ModelPieChartsProps) => {
  const [pieData, setPieData] = useState<Record<TabType, PieData[]>>({
    modelCost: [],
    tokenDistribution: [],
    modelCalls: [],
    modelTokens: [],
  });
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('modelCost');

  useEffect(() => {
    const fetchModelStats = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filters.startTime) params.append('startTime', filters.startTime.toString());
        if (filters.endTime) params.append('endTime', filters.endTime.toString());
        if (filters.user) params.append('user', filters.user);
        if (filters.model) params.append('model', filters.model);
        if (filters.token) params.append('token', filters.token);

        const [modelsResponse, summaryResponse] = await Promise.all([
          fetch(`/api/stats/models?${params}`),
          fetch(`/api/stats/summary?${params}`),
        ]);

        if (modelsResponse.ok && summaryResponse.ok) {
          const result = await modelsResponse.json();
          const summary: SummaryStats = await summaryResponse.json();
          const models: ModelData[] = result.data;
          const nonCacheInput = Math.max(0, summary.inputTokens - summary.cacheTokens);

          setPieData({
            modelCost: models
              .filter((m) => m.cost > 0)
              .map((m) => ({ name: m.model, value: m.cost })),
            tokenDistribution: [
              { name: '非缓存输入', value: nonCacheInput },
              { name: '输出', value: summary.outputTokens },
              { name: '缓存', value: summary.cacheTokens },
            ].filter((item) => item.value > 0),
            modelCalls: models
              .filter((m) => m.calls > 0)
              .map((m) => ({ name: m.model, value: m.calls })),
            modelTokens: models
              .filter((m) => m.totalTokens > 0)
              .map((m) => ({ name: m.model, value: m.totalTokens })),
          });
          setCurrencySymbol(result.currencySymbol || '$');
        }
      } catch (error) {
        console.error('Failed to fetch model stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchModelStats();
  }, [filters, refreshKey]);

  const renderPieChart = (tab: TabType) => {
    const data = pieData[tab];
    const total = data.reduce((sum, item) => sum + item.value, 0);

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
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={tab === 'tokenDistribution' ? tokenRenderLabel : renderLabel}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry) => (
              <Cell key={`cell-${entry.name}`} fill={PIE_CHART_COLORS[data.indexOf(entry) % PIE_CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            content={(props) => (
              <PieTooltipContent
                {...props}
                formatValue={tab === 'modelCost' ? (value) => formatCurrencyAmount(value, currencySymbol) : formatPieValue}
                total={total}
                unit={TAB_CONFIG[tab].unit}
              />
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <PieChartIcon className="h-5 w-5" />
          分布统计
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
          <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
            {(Object.keys(TAB_CONFIG) as TabType[]).map((key) => (
              <TabsTrigger key={key} value={key} className="flex items-center gap-1 text-xs">
                {TAB_CONFIG[key].icon}
                <span className="hidden sm:inline">{TAB_CONFIG[key].label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          {(Object.keys(TAB_CONFIG) as TabType[]).map((key) => (
            <TabsContent key={key} value={key} className="mt-4">
              {renderPieChart(key)}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
