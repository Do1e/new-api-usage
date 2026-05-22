import { z } from 'zod';

const requiredStringSchema = (name: string) =>
  z.preprocess(
    (value) => value ?? '',
    z.string().min(1, `${name} is required`),
  );
const databaseUrlSchema = requiredStringSchema('DATABASE_URL');

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

const defaultRecentDaysSchema = z.preprocess(
  (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  },
  z.number().int().min(0).default(0),
);

export function getDefaultRecentDays() {
  return readEnv('DEFAULT_RECENT_DAYS', defaultRecentDaysSchema);
}
