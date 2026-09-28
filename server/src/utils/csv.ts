import type { Response } from 'express';

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function toCsv(rows: Record<string, unknown>[], columns?: { key: string; label: string }[]): string {
  if (!rows.length && !columns?.length) return '';
  const cols =
    columns ??
    Object.keys(rows[0] ?? {}).map((key) => ({ key, label: key }));
  const header = cols.map((c) => escapeCell(c.label)).join(',');
  const body = rows.map((row) => cols.map((c) => escapeCell(row[c.key])).join(',')).join('\n');
  return `${header}\n${body}`;
}

export function sendCsv(res: Response, filename: string, csv: string) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  // BOM so Excel opens UTF-8 correctly
  res.send('﻿' + csv);
}
