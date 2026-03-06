export type TimestampValue = string | number | null | undefined;

export function resurrectCursor(cursor: string | null): string | null {
  if (!cursor) return null;
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);
    parsed.exp = Date.now() + 3600000;
    return Buffer.from(JSON.stringify(parsed)).toString('base64');
  } catch (e) {
    return cursor;
  }
}

export function computeResetTimeMs(limitResetHeader: string | null): number {
  const defaultMs = 15000;
  if (!limitResetHeader) return defaultMs;
  const resetVal = parseInt(limitResetHeader, 10);
  if (Number.isNaN(resetVal)) return defaultMs;
  const candidate = resetVal > 1000000000
    ? resetVal * 1000 - Date.now()
    : resetVal * 1000;
  return Math.max(candidate, 5000);
}

export function normalizeTimestamp(value: TimestampValue): string | null {
  if (value === null || value === undefined) return null;
  try {
    const ts = typeof value === 'number' && value < 10000000000
      ? value * 1000
      : value;
    const iso = new Date(ts).toISOString();
    return iso;
  } catch (e) {
    return null;
  }
}

export function extractEventId(event: { id?: string; _id?: string } | null | undefined): string | null {
  if (!event) return null;
  return event.id || event._id || null;
}
