import { describe, expect, it } from 'vitest';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';

describe('metadata routes', () => {
  it('lists Phase 1 routes in the sitemap', () => {
    const urls = sitemap().map((entry) => entry.url);

    expect(urls).toContain('https://onlineredactor.pages.dev/');
    expect(urls).toContain('https://onlineredactor.pages.dev/app');
    expect(urls).toContain('https://onlineredactor.pages.dev/hipaa-pdf-redaction');
    expect(urls).toContain('https://onlineredactor.pages.dev/redact-bank-statement');
    expect(urls).toContain('https://onlineredactor.pages.dev/legal/terms');
    expect(urls).toContain('https://onlineredactor.pages.dev/legal/dpa');
  });

  it('allows crawlers and points to the sitemap', () => {
    expect(robots()).toMatchObject({
      rules: { userAgent: '*', allow: '/' },
      sitemap: 'https://onlineredactor.pages.dev/sitemap.xml',
    });
  });
});
