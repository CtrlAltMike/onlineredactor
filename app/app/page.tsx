'use client';

import { RedactorClient } from './redactor-client';

export default function AppPage() {
  return (
    <main className="max-w-5xl mx-auto px-4 pt-8 pb-16">
      <h1 className="sr-only">Redact a PDF</h1>
      <RedactorClient />
    </main>
  );
}
