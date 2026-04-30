import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="border-b border-neutral-200">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold tracking-tight">
          OnlineRedactor
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/pricing">Pricing</Link>
          <Link href="/security">Security</Link>
          <Link href="/account">Account</Link>
          <Link href="/privacy">Privacy</Link>
          <Link
            href="/app"
            className="rounded-md bg-black text-white px-3 py-1.5 text-sm"
          >
            Open tool
          </Link>
        </nav>
      </div>
    </header>
  );
}
