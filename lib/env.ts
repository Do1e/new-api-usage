import { z } from 'zod';

const requiredStringSchema = (name: string) =>
  z.preprocess(
    (value) => value ?? '',
    z.string().min(1, `${name} is required`),
  );
const databaseUrlSchema = requiredStringSchema('DATABASE_URL');
const costCurrencySymbolSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : '$'),
  z.string().min(1),
);
const costExchangeRateSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : '1:1'),
  z.string().trim().refine((value) => {
    const [baseRaw, targetRaw, extra] = value.split(':');
    const base = Number(baseRaw);
    const target = Number(targetRaw);

    return extra === undefined && Number.isFinite(base) && base > 0 && Number.isFinite(target) && target >= 0;
  }, { message: 'COST_EXCHANGE_RATE must use ratio like 1:7' }),
);

const cache = new Map<string, unknown>();

function readEnv<T>(name: string, schema: z.ZodType<T>): T {
  if (cache.has(name)) {
    return cache.get(name) as T;
  }
  const value = schema.parse(process.env[name]);
  cache.set(name, value);
  return value;
}

export function getDatabaseUrl() {
  return readEnv('DATABASE_URL', databaseUrlSchema);
}

export function getDashboardPassword() {
  return readEnv('DASHBOARD_PASSWORD', requiredStringSchema('DASHBOARD_PASSWORD'));
}

export function getSessionSecret() {
  return readEnv('SESSION_SECRET', requiredStringSchema('SESSION_SECRET'));
}

export function getCostCurrencySymbol() {
  return readEnv('COST_CURRENCY_SYMBOL', costCurrencySymbolSchema);
}

export function getCostExchangeRate() {
  return readEnv('COST_EXCHANGE_RATE', costExchangeRateSchema);
}

const defaultRecentDaysSchema = z.preprocess(
  (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 7;
  },
  z.number().int().min(0).default(7),
);

export function getDefaultRecentDays() {
  return readEnv('DEFAULT_RECENT_DAYS', defaultRecentDaysSchema);
}
