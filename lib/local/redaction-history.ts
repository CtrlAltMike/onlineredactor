export const REDACTION_HISTORY_STORAGE_KEY =
  'onlineredactor.redaction-history.v1';
export const MAX_REDACTION_HISTORY = 20;

export type RedactionHistoryEntry = {
  id: string;
  createdAt: string;
  pageCount: number;
  regionCount: number;
  verifiedStringCount: number;
  outputSha256: string;
};

export function readRedactionHistory(
  storage: Storage | null | undefined
): RedactionHistoryEntry[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(REDACTION_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isHistoryEntry).slice(0, MAX_REDACTION_HISTORY);
  } catch {
    return [];
  }
}

export function addRedactionHistoryEntry(
  storage: Storage | null | undefined,
  entry: Omit<RedactionHistoryEntry, 'id' | 'createdAt'>,
  now = new Date()
): RedactionHistoryEntry[] {
  const nextEntry: RedactionHistoryEntry = {
    id: `${now.getTime()}-${entry.outputSha256.slice(0, 12)}`,
    createdAt: now.toISOString(),
    ...entry,
  };
  const next = [
    nextEntry,
    ...readRedactionHistory(storage).filter(
      (existing) => existing.outputSha256 !== entry.outputSha256
    ),
  ].slice(0, MAX_REDACTION_HISTORY);
  writeHistory(storage, next);
  return next;
}

export function clearRedactionHistory(
  storage: Storage | null | undefined
): RedactionHistoryEntry[] {
  writeHistory(storage, []);
  return [];
}

function writeHistory(
  storage: Storage | null | undefined,
  history: RedactionHistoryEntry[]
) {
  if (!storage) return;
  try {
    storage.setItem(REDACTION_HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch {
    // History is intentionally local and optional.
  }
}

function isHistoryEntry(value: unknown): value is RedactionHistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RedactionHistoryEntry>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.createdAt === 'string' &&
    typeof candidate.pageCount === 'number' &&
    typeof candidate.regionCount === 'number' &&
    typeof candidate.verifiedStringCount === 'number' &&
    typeof candidate.outputSha256 === 'string'
  );
}
