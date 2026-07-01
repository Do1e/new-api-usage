'use client';

import { useEffect, useState } from 'react';

import { Loader2, MousePointerClick, ArrowDownToLine, ArrowUpFromLine, Archive, Database, DollarSign } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCompactNumber, formatCurrencyAmount } from '@/lib/chart';

interface FilterState {
  startTime: number | null;
  endTime: number | null;
  user: string | null;
  model: string | null;
  token: string | null;
}

interface SummaryStats {
  totalCalls: number;
  totalCost: number;
  currencySymbol: string;
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
  totalTokens: number;
}

interface SummaryCardsProps {
  filters: FilterState;
  refreshKey: number;
}

export const SummaryCards = ({ filters, refreshKey }: SummaryCardsProps) => {
  const [stats, setStats] = useState<SummaryStats | null>(null);
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
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [filters, refreshKey]);

  const cards = [
    {
      title: '总费用',
      value: stats?.totalCost || 0,
      icon: DollarSign,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
      currency: true,
    },
    {
      title: '调用次数',
      value: stats?.totalCalls || 0,
      icon: MousePointerClick,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: '总Token',
      value: stats?.totalTokens || 0,
      icon: Database,
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-500/10',
    },
    {
      title: '输入Token',
      value: stats?.inputTokens || 0,
      icon: ArrowDownToLine,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: '缓存Token',
      value: stats?.cacheTokens || 0,
      icon: Archive,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: '输出Token',
      value: stats?.outputTokens || 0,
      icon: ArrowUpFromLine,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <div className={`${card.bgColor} p-2 rounded-md`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <div className="text-2xl font-bold">
                {card.currency ? formatCurrencyAmount(card.value, stats?.currencySymbol || '$') : formatCompactNumber(card.value, { precision: 3 })}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
