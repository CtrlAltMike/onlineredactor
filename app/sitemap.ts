import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

const baseUrl = 'https://onlineredactor.pages.dev';

const routes = [
  '/',
  '/app',
  '/pricing',
  '/privacy',
  '/security',
  '/how-it-works',
  '/free-pdf-redactor',
  '/redact-pdf-online',
  '/redact-ssn-from-pdf',
  '/hipaa-pdf-redaction',
  '/redact-bank-statement',
  '/legal/license',
  '/legal/terms',
  '/legal/dpa',
];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    changeFrequency: route === '/' || route === '/app' ? 'weekly' : 'monthly',
    priority: route === '/' ? 1 : route === '/app' ? 0.9 : 0.7,
  }));
}
