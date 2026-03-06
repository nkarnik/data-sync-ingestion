import { describe, expect, it, vi } from 'vitest';
import {
  computeResetTimeMs,
  extractEventId,
  normalizeTimestamp,
  resurrectCursor,
} from '../../src/ingestion-helpers';

describe('computeResetTimeMs', () => {
  it('returns default for null or invalid header', () => {
    expect(computeResetTimeMs(null)).toBe(15000);
    expect(computeResetTimeMs('not-a-number')).toBe(15000);
  });

  it('treats small numbers as seconds and clamps to 5s', () => {
    expect(computeResetTimeMs('1')).toBe(5000);
    expect(computeResetTimeMs('10')).toBe(10000);
  });

  it('treats large numbers as epoch seconds', () => {
    const now = 1700000000000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const inTwoSeconds = Math.floor((now + 2000) / 1000);
    expect(computeResetTimeMs(String(inTwoSeconds))).toBe(5000);
  });
});

describe('normalizeTimestamp', () => {
  it('normalizes seconds epoch', () => {
    expect(normalizeTimestamp(1700000000)).toBe(new Date(1700000000 * 1000).toISOString());
  });

  it('passes through milliseconds epoch', () => {
    expect(normalizeTimestamp(1700000000000)).toBe(new Date(1700000000000).toISOString());
  });

  it('returns null for invalid values', () => {
    expect(normalizeTimestamp('invalid-date')).toBeNull();
  });
});

describe('extractEventId', () => {
  it('prefers id then _id', () => {
    expect(extractEventId({ id: 'abc' })).toBe('abc');
    expect(extractEventId({ _id: 'xyz' })).toBe('xyz');
  });

  it('returns null for missing event', () => {
    expect(extractEventId(null)).toBeNull();
  });
});

describe('resurrectCursor', () => {
  it('updates exp field for base64 json', () => {
    const now = 1700000000000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const payload = Buffer.from(JSON.stringify({ exp: 0, foo: 'bar' })).toString('base64');
    const resurrected = resurrectCursor(payload);
    const decoded = JSON.parse(Buffer.from(resurrected as string, 'base64').toString('utf-8'));
    expect(decoded.exp).toBe(now + 3600000);
    expect(decoded.foo).toBe('bar');
  });

  it('returns original on invalid base64', () => {
    expect(resurrectCursor('not-base64')).toBe('not-base64');
  });
});
