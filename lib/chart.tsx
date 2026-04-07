export const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f97316', '#8b5cf6', '#ec4899',
  '#14b8a6', '#f59e0b', '#6366f1', '#ef4444', '#84cc16',
];

interface FormatCompactNumberOptions {
  lowercaseSuffix?: boolean;
  precision?: number;
}

export const formatCompactNumber = (
  value: number,
  { lowercaseSuffix = false, precision = 1 }: FormatCompactNumberOptions = {},
) => {
  const thousandSuffix = lowercaseSuffix ? 'k' : 'K';
  const millionSuffix = lowercaseSuffix ? 'm' : 'M';

  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(precision)}${millionSuffix}`;
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(precision)}${thousandSuffix}`;
  }

  return value.toString();
};
