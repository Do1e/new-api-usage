'use client';

interface PieLabelProps {
  name?: string;
  percent?: number;
}

interface PieTooltipContentProps {
  active?: boolean;
  formatValue: (value: number) => string;
  payload?: ReadonlyArray<{
    name?: number | string;
    value?: number | string | ReadonlyArray<number | string>;
  }>;
  total: number;
  unit: string;
}

export const PIE_CHART_COLORS = [
  '#3b82f6', '#10b981', '#f97316', '#8b5cf6', '#ec4899',
  '#14b8a6', '#f59e0b', '#6366f1', '#ef4444', '#84cc16',
];

export const MIN_LABEL_PERCENT = 0.02;

export const formatPieValue = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)  }M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)  }K`;
  return value.toString();
};

export const createPieLabelRenderer = (precision = 0) => {
  return ({ name, percent }: PieLabelProps) => {
    if (!name || !percent || percent < MIN_LABEL_PERCENT) {
      return '';
    }

    return `${name}: ${(percent * 100).toFixed(precision)}%`;
  };
};

export const PieTooltipContent = ({
  active,
  formatValue,
  payload,
  total,
  unit,
}: PieTooltipContentProps) => {
  if (!active || !payload?.length) {
    return null;
  }

  const item = payload[0];
  const rawValue = Array.isArray(item.value) ? item.value[0] : item.value;
  const value = Number(rawValue || 0);
  const percent = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';

  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      <div>{String(item.name || '-')}</div>
      <div>{`${formatValue(value)} ${unit}`}</div>
      <div>{`${percent}%`}</div>
    </div>
  );
};
