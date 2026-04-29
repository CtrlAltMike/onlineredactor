export const FREE_REDACTION_LIMIT = 3;
export const FREE_USAGE_STORAGE_KEY = 'onlineredactor.free-usage.v1';

export type FreeUsageRecord = {
  date: string;
  count: number;
};

export type FreeUsageSnapshot = FreeUsageRecord & {
  limit: number;
  remaining: number;
  isCapped: boolean;
};

export function readFreeUsage(
  storage: Storage | null | undefined,
  now = new Date()
): FreeUsageSnapshot {
  const today = localDateKey(now);
  const fallback: FreeUsageRecord = { date: today, count: 0 };
  const record = readRecord(storage) ?? fallback;
  const current = record.date === today ? record : fallback;
  return snapshot(current);
}

export function recordFreeRedaction(
  storage: Storage | null | undefined,
  now = new Date()
): FreeUsageSnapshot {
  const current = readFreeUsage(storage, now);
  const next: FreeUsageRecord = {
    date: current.date,
    count: current.count + 1,
  };
  writeRecord(storage, next);
  return snapshot(next);
}

function snapshot(record: FreeUsageRecord): FreeUsageSnapshot {
  const remaining = Math.max(0, FREE_REDACTION_LIMIT - record.count);
  return {
    ...record,
    limit: FREE_REDACTION_LIMIT,
    remaining,
    isCapped: remaining === 0,
  };
}

function readRecord(storage: Storage | null | undefined): FreeUsageRecord | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(FREE_USAGE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FreeUsageRecord>;
    if (typeof parsed.date !== 'string') return null;
    if (typeof parsed.count !== 'number' || !Number.isFinite(parsed.count)) {
      return null;
    }
    return { date: parsed.date, count: Math.max(0, Math.floor(parsed.count)) };
  } catch {
    return null;
  }
}

function writeRecord(
  storage: Storage | null | undefined,
  record: FreeUsageRecord
) {
  if (!storage) return;
  try {
    storage.setItem(FREE_USAGE_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Private browsing and locked-down environments can reject localStorage.
    // The free cap is an honor-system nudge, so storage failure should not
    // block verified redaction.
  }
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
