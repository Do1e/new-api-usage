'use client';

import { useEffect, useState } from 'react';

import { ChevronLeft, ChevronRight, FileText, Loader2, RefreshCw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCompactNumber } from '@/lib/chart';


interface FilterState {
  startTime: number | null;
  endTime: number | null;
  user: string | null;
  model: string | null;
  token: string | null;
}

interface LogEntry {
  id: number;
  time: number;
  timeFormatted: string;
  user: string;
  model: string;
  tokenName: string;
  channel: string;
  isStream: boolean;
  useTime: number;
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
  firstTokenTime: number;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface LogsTableProps {
  filters: FilterState;
  refreshKey: number;
}

export const LogsTable = ({ filters, refreshKey }: LogsTableProps) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [localRefreshKey, setLocalRefreshKey] = useState(0);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const showLoadingOverlay = loading && logs.length > 0;

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.append('page', pagination.page.toString());
        params.append('limit', pagination.limit.toString());
        if (filters.startTime) params.append('startTime', filters.startTime.toString());
        if (filters.endTime) params.append('endTime', filters.endTime.toString());
        if (filters.user) params.append('user', filters.user);
        if (filters.model) params.append('model', filters.model);
        if (filters.token) params.append('token', filters.token);

        const response = await fetch(`/api/logs?${params}`);
        if (response.ok) {
          const result = await response.json();
          setLogs(result.logs);
          setPagination(result.pagination);
        }
      } catch (error) {
        console.error('Failed to fetch logs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [filters, pagination.page, pagination.limit, refreshKey, localRefreshKey]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination((prev) => ({ ...prev, page: newPage }));
    }
  };

  const formatFirstTokenTime = (firstTokenTime: number, isStream: boolean) => {
    if (!isStream) return '非流';
    return `${(firstTokenTime / 1000).toFixed(3)}s`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          日志详情
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocalRefreshKey((prev) => prev + 1)}
            disabled={loading}
            title="刷新日志详情"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <div className="text-sm text-muted-foreground">
          共 {pagination.total} 条记录
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative min-h-112" aria-busy={loading}>
          <div className="space-y-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>用户</TableHead>
                    <TableHead>模型</TableHead>
                    <TableHead>令牌</TableHead>
                    <TableHead className="text-right">用时</TableHead>
                    <TableHead className="text-right">首字</TableHead>
                    <TableHead className="text-right">输入</TableHead>
                    <TableHead className="text-right">缓存</TableHead>
                    <TableHead className="text-right">输出</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                        暂无日志
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs">
                          {log.timeFormatted}
                        </TableCell>
                        <TableCell className="text-sm">{log.user}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {log.model}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{log.tokenName || '-'}</TableCell>
                        <TableCell className="text-right font-mono">
                          {log.useTime}s
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatFirstTokenTime(log.firstTokenTime, log.isStream)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCompactNumber(log.inputTokens, { lowercaseSuffix: true })}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCompactNumber(log.cacheTokens, { lowercaseSuffix: true })}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCompactNumber(log.outputTokens, { lowercaseSuffix: true })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  第 {pagination.page} / {pagination.totalPages} 页
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={loading || pagination.page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={loading || pagination.page >= pagination.totalPages}
                  >
                    下一页
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/70">
              <Loader2 className={`h-8 w-8 animate-spin ${showLoadingOverlay ? '' : 'text-muted-foreground'}`} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
