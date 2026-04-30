import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Miniflare } from 'miniflare';
import type { AccountEnv } from '@/lib/cloudflare/account-api';

export async function createTestEnv(): Promise<{
  env: AccountEnv;
  miniflare: Miniflare;
}> {
  const miniflare = new Miniflare({
    modules: true,
    script: 'export default {}',
    d1Databases: ['DB'],
  });
  const db = await miniflare.getD1Database('DB');
  for (const file of readdirSync('migrations').filter((name) =>
    name.endsWith('.sql')
  ).sort()) {
    const migration = readFileSync(join('migrations', file), 'utf8');
    for (const statement of migration.split(/;\s*\n/)) {
      const sql = statement.trim();
      if (sql) await db.prepare(`${sql};`).run();
    }
  }
  return {
    miniflare,
    env: {
      DB: db,
      APP_BASE_URL: 'https://example.com',
      AUTH_DEV_SHOW_MAGIC_LINK: 'true',
      COOKIE_SECURE: 'false',
    },
  };
}

export function jsonRequest(path: string, body: unknown): Request {
  return new Request(`https://example.com${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
