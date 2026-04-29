import { describe, expect, it } from 'vitest';
import {
  addRedactionHistoryEntry,
  clearRedactionHistory,
  readRedactionHistory,
} from '@/lib/local/redaction-history';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe('redaction history', () => {
  it('records only content-free export metadata', () => {
    const storage = new MemoryStorage();
    const history = addRedactionHistoryEntry(
      storage,
      {
        pageCount: 2,
        regionCount: 3,
        verifiedStringCount: 4,
        outputSha256: 'abc1234567890',
      },
      new Date('2026-04-29T12:00:00Z')
    );

    expect(history).toEqual([
      expect.objectContaining({
        createdAt: '2026-04-29T12:00:00.000Z',
        pageCount: 2,
        regionCount: 3,
        verifiedStringCount: 4,
        outputSha256: 'abc1234567890',
      }),
    ]);
    expect(JSON.stringify(history)).not.toContain('Jane Doe');
    expect(JSON.stringify(history)).not.toContain('123-45-6789');
  });

  it('clears local history', () => {
    const storage = new MemoryStorage();
    addRedactionHistoryEntry(storage, {
      pageCount: 1,
      regionCount: 1,
      verifiedStringCount: 1,
      outputSha256: 'hash',
    });

    expect(clearRedactionHistory(storage)).toEqual([]);
    expect(readRedactionHistory(storage)).toEqual([]);
  });
});
