import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="border-b border-neutral-200">
      <div className="mx-auto flex min-h-14 max-w-5xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:h-14 sm:flex-nowrap sm:justify-between sm:py-0">
        <Link href="/" className="font-semibold tracking-tight">
          OnlineRedactor
        </Link>
        <nav className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 text-sm sm:w-auto sm:gap-6">
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
