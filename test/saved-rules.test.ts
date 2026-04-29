import { describe, expect, it } from 'vitest';
import {
  deleteRule,
  readSavedRules,
  saveRule,
  SAVED_RULES_STORAGE_KEY,
} from '@/lib/local/saved-rules';

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

describe('saved rules', () => {
  it('saves trimmed text search rules without duplicates', () => {
    const storage = new MemoryStorage();

    saveRule(storage, { query: '  123-45-6789  ' }, new Date('2026-04-29T12:00:00Z'));
    const rules = saveRule(storage, { query: '123-45-6789' }, new Date('2026-04-29T12:01:00Z'));

    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({
      name: '123-45-6789',
      query: '123-45-6789',
    });
  });

  it('deletes a saved rule', () => {
    const storage = new MemoryStorage();
    const [rule] = saveRule(storage, { query: 'case-123' });

    expect(deleteRule(storage, rule.id)).toEqual([]);
  });

  it('ignores malformed stored data', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVED_RULES_STORAGE_KEY, JSON.stringify([{ id: 'x' }]));

    expect(readSavedRules(storage)).toEqual([]);
  });
});
