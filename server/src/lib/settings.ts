import { prisma } from './prisma';
import { env } from '../config/env';

export const DEFAULT_SETTINGS: Record<string, unknown> = {
  company: {
    name: 'Voxpact Financials',
    legalName: 'Voxpact',
    address: 'Lahore, Pakistan',
    email: 'finance@voxpact.com',
    tagline: 'Financial Management Portal',
  },
  currency: env.CURRENCY,
  dailyBudget: env.DEFAULT_DAILY_BUDGET,
  overdueGraceDays: 3,
  categories: [
    'Operations',
    'Marketing',
    'Salary',
    'Utilities',
    'Rent',
    'Software',
    'Internet',
    'Travel',
    'Equipment',
    'Taxes',
    'Miscellaneous',
  ],
  paymentMethods: ['Cash', 'Bank Transfer', 'Credit Card', 'Debit Card', 'Wise', 'Payoneer', 'Other'],
  distributableProfit: 0,
};

export async function getSetting<T = unknown>(key: string): Promise<T> {
  const row = await prisma.setting.findUnique({ where: { key } });
  if (row) return row.value as T;
  return DEFAULT_SETTINGS[key] as T;
}

export async function getSettings(): Promise<Record<string, unknown>> {
  const rows = await prisma.setting.findMany();
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of rows) merged[row.key] = row.value;
  return merged;
}

export async function setSetting(key: string, value: unknown) {
  return prisma.setting.upsert({
    where: { key },
    update: { value: value as any },
    create: { key, value: value as any },
  });
}
