export const SAVED_RULES_STORAGE_KEY = 'onlineredactor.saved-rules.v1';
export const MAX_SAVED_RULES = 20;

export type SavedRule = {
  id: string;
  name: string;
  query: string;
  createdAt: string;
};

export function readSavedRules(
  storage: Storage | null | undefined
): SavedRule[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(SAVED_RULES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedRule).slice(0, MAX_SAVED_RULES);
  } catch {
    return [];
  }
}

export function saveRule(
  storage: Storage | null | undefined,
  input: { name?: string; query: string },
  now = new Date()
): SavedRule[] {
  const query = input.query.trim();
  if (!query) return readSavedRules(storage);
  const name = (input.name?.trim() || query).slice(0, 80);
  const rules = readSavedRules(storage).filter(
    (rule) => rule.query.toLowerCase() !== query.toLowerCase()
  );
  const next = [
    {
      id: stableRuleId(query, now),
      name,
      query,
      createdAt: now.toISOString(),
    },
    ...rules,
  ].slice(0, MAX_SAVED_RULES);
  writeRules(storage, next);
  return next;
}

export function deleteRule(
  storage: Storage | null | undefined,
  id: string
): SavedRule[] {
  const next = readSavedRules(storage).filter((rule) => rule.id !== id);
  writeRules(storage, next);
  return next;
}

function writeRules(storage: Storage | null | undefined, rules: SavedRule[]) {
  if (!storage) return;
  try {
    storage.setItem(SAVED_RULES_STORAGE_KEY, JSON.stringify(rules));
  } catch {
    // Local rules are a convenience feature. Locked-down storage should not
    // block verified redaction.
  }
}

function stableRuleId(query: string, now: Date): string {
  return `${now.getTime()}-${query.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32)}`;
}

function isSavedRule(value: unknown): value is SavedRule {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SavedRule>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.query === 'string' &&
    typeof candidate.createdAt === 'string'
  );
}
