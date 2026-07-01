import { getCostCurrencySymbol, getCostExchangeRate } from '@/lib/env';

const QUOTA_PER_BASE_UNIT = 500_000;

export const parseCostExchangeRate = (value: string) => {
  const [baseRaw, targetRaw, extra] = value.split(':');
  const base = Number(baseRaw);
  const target = Number(targetRaw);

  if (extra !== undefined || !Number.isFinite(base) || base <= 0 || !Number.isFinite(target) || target < 0) {
    throw new Error('COST_EXCHANGE_RATE must use ratio like 1:7');
  }

  return target / base;
};

export const quotaToCost = (quota: number, exchangeRate: number) => {
  return (quota / QUOTA_PER_BASE_UNIT) * exchangeRate;
};

export const getCostDisplayConfig = () => ({
  currencySymbol: getCostCurrencySymbol(),
  exchangeRate: parseCostExchangeRate(getCostExchangeRate()),
});
