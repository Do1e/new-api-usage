'use client';

import { useState, useEffect, useMemo } from 'react';

import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { CalendarIcon, RefreshCw, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { cn } from '@/lib/utils';

interface TokenOption {
  name: string;
  username: string;
}

interface FilterState {
  startTime: number | null;
  endTime: number | null;
  user: string | null;
  model: string | null;
  token: string | null;
}

interface FiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onRefresh: () => void;
}

// DateTimePicker component for selecting date and time
const DateTimePicker = ({
  label,
  value,
  onChange,
  placeholder = '选择日期时间',
}: {
  label: string;
  value: number | null;
  onChange: (timestamp: number | null) => void;
  placeholder?: string;
}) => {
  const [date, setDate] = useState<Date | undefined>(
    value ? new Date(value * 1000) : undefined
  );
  const [time, setTime] = useState<string>(
    value ? format(new Date(value * 1000), 'HH:mm') : '00:00'
  );

  const handleDateChange = (newDate: Date | undefined) => {
    if (newDate) {
      setDate(newDate);
      const [hours, minutes] = time.split(':').map(Number);
      const newDateTime = new Date(newDate);
      newDateTime.setHours(hours || 0, minutes || 0, 0, 0);
      onChange(Math.floor(newDateTime.getTime() / 1000));
    } else {
      setDate(undefined);
      onChange(null);
    }
  };

  const handleTimeChange = (newTime: string) => {
    setTime(newTime);
    if (date && /^\d{2}:\d{2}$/.test(newTime)) {
      const [hours, minutes] = newTime.split(':').map(Number);
      const newDateTime = new Date(date);
      newDateTime.setHours(hours || 0, minutes || 0, 0, 0);
      onChange(Math.floor(newDateTime.getTime() / 1000));
    }
  };

  const clearDate = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDate(undefined);
    setTime('00:00');
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-55 justify-start text-left font-normal',
              !value && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? (
              <span className="flex-1">
                {format(new Date(value * 1000), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
              </span>
            ) : (
              <span className="flex-1">{placeholder}</span>
            )}
            {value && (
              <span
                onClick={clearDate}
                className="ml-1 p-1 rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer inline-flex items-center"
                title="清除"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    clearDate(e as unknown as React.MouseEvent);
                  }
                }}
              >
                <X className="h-3.5 w-3.5 opacity-50 hover:opacity-100" />
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-3 space-y-3">
            <Calendar
              mode="single"
              selected={date}
              onSelect={handleDateChange}
              initialFocus
            />
            <div className="flex items-center gap-2 px-2 pb-2">
              <Label className="text-xs text-muted-foreground">时间</Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => handleTimeChange(e.target.value)}
                className="w-30 h-8"
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export const Filters = ({
  filters,
  onFiltersChange,
  onRefresh,
}: FiltersProps) => {
  const [filterOptions, setFilterOptions] = useState<{
    users: string[];
    models: string[];
    tokens: TokenOption[];
  }>({ users: [], models: [], tokens: [] });

  const tokenValue = useMemo(() => {
    if (!filters.token) return null;
    const match = filterOptions.tokens.find((t) => t.name === filters.token);
    return match ? `${match.name}::${match.username}` : filters.token;
  }, [filters.token, filterOptions.tokens]);

  // Fetch filter options
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const response = await fetch('/api/filters');
        if (response.ok) {
          const data = await response.json();
          setFilterOptions({
            users: data.users,
            models: data.models,
            tokens: data.tokens,
          });
        }
      } catch (error) {
        console.error('Failed to fetch filter options:', error);
      }
    };
    fetchOptions();
  }, []);

  return (
    <div className="bg-card rounded-lg border p-4 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        {/* Start Time Filter */}
        <DateTimePicker
          label="开始时间"
          value={filters.startTime}
          onChange={(value) => onFiltersChange({ ...filters, startTime: value })}
          placeholder="选择开始时间"
        />

        {/* End Time Filter */}
        <DateTimePicker
          label="结束时间"
          value={filters.endTime}
          onChange={(value) => onFiltersChange({ ...filters, endTime: value })}
          placeholder="选择结束时间"
        />

        <div className="space-y-2">
          <Label className="text-sm font-medium">用户</Label>
          <SearchableSelect
            options={filterOptions.users.map((u) => ({ value: u, label: u }))}
            value={filters.user}
            onValueChange={(value) => onFiltersChange({ ...filters, user: value })}
            placeholder="全部用户"
            searchPlaceholder="搜索用户..."
            emptyText="未找到用户"
            allLabel="全部用户"
            className="w-45"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">模型</Label>
          <SearchableSelect
            options={filterOptions.models.map((m) => ({ value: m, label: m }))}
            value={filters.model}
            onValueChange={(value) => onFiltersChange({ ...filters, model: value })}
            placeholder="全部模型"
            searchPlaceholder="搜索模型..."
            emptyText="未找到模型"
            allLabel="全部模型"
            className="w-50"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">令牌</Label>
          <SearchableSelect
            options={filterOptions.tokens.map((t) => ({
              value: `${t.name}::${t.username}`,
              label: `${t.name} (${t.username})`,
            }))}
            value={tokenValue}
            onValueChange={(value) =>
              onFiltersChange({ ...filters, token: value ? value.split('::')[0] : null })
            }
            placeholder="全部令牌"
            searchPlaceholder="搜索令牌..."
            emptyText="未找到令牌"
            allLabel="全部令牌"
            className="w-50"
          />
        </div>

        {/* Refresh Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={onRefresh}
          className="h-10 w-10"
          title="刷新"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
