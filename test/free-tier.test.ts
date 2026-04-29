import { describe, expect, it } from 'vitest';
import {
  FREE_USAGE_STORAGE_KEY,
  readFreeUsage,
  recordFreeRedaction,
} from '@/lib/usage/free-tier';

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

describe('free-tier usage counter', () => {
  it('starts with three remaining redactions', () => {
    const usage = readFreeUsage(
      new MemoryStorage(),
      new Date('2026-04-29T12:00:00')
    );

    expect(usage).toMatchObject({
      date: '2026-04-29',
      count: 0,
      limit: 3,
      remaining: 3,
      isCapped: false,
    });
  });

  it('records verified redactions and caps at three', () => {
    const storage = new MemoryStorage();
    const now = new Date('2026-04-29T12:00:00');

    recordFreeRedaction(storage, now);
    recordFreeRedaction(storage, now);
    const usage = recordFreeRedaction(storage, now);

    expect(usage).toMatchObject({
      count: 3,
      remaining: 0,
      isCapped: true,
    });
  });

  it('resets on the next local day', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      FREE_USAGE_STORAGE_KEY,
      JSON.stringify({ date: '2026-04-29', count: 3 })
    );

    const usage = readFreeUsage(storage, new Date('2026-04-30T09:00:00'));

    expect(usage).toMatchObject({
      date: '2026-04-30',
      count: 0,
      remaining: 3,
      isCapped: false,
    });
  });

  it('treats broken storage as uncapped', () => {
    const storage = {
      getItem: () => {
        throw new Error('blocked');
      },
    } as unknown as Storage;

    expect(readFreeUsage(storage).isCapped).toBe(false);
  });
});
