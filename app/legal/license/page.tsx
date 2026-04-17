import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Read once at build time (server component). The LICENSE file lives at the
// repo root; we resolve from process.cwd() which is the project root during
// `next build`.
const licenseText = readFileSync(resolve(process.cwd(), 'LICENSE'), 'utf8');

export const metadata = {
  title: 'License — OnlineRedactor',
  description:
    'OnlineRedactor is distributed under the GNU Affero General Public License v3.0 or later.',
};

export default function LicensePage() {
  return (
    <main className="max-w-3xl mx-auto px-4 pt-16 pb-24">
      <h1 className="text-4xl font-semibold tracking-tight">License</h1>

      <p className="mt-6 text-neutral-700">
        OnlineRedactor is distributed under the GNU Affero General Public
        License v3.0 or later (AGPL-3.0-or-later). The full license text is
        below. Our source is available at{' '}
        <a
          href="https://github.com/CtrlAltMike/onlineredactor"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-neutral-900"
        >
          github.com/CtrlAltMike/onlineredactor
        </a>
        .
      </p>

      <pre className="mt-8 rounded-md bg-neutral-100 p-4 text-xs overflow-x-auto whitespace-pre-wrap break-words">
        {licenseText}
      </pre>
    </main>
  );
}
