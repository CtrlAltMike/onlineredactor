export function SiteFooter() {
  return (
    <footer className="border-t border-neutral-200 mt-16">
      <div className="max-w-5xl mx-auto px-4 py-8 text-xs text-neutral-500 flex items-center justify-between">
        <span>
          © {new Date().getFullYear()} OnlineRedactor
          <span aria-hidden> · </span>
          <a href="/legal/license" className="hover:text-neutral-700 underline-offset-2 hover:underline">
            AGPL-3.0
          </a>
          <span aria-hidden> · </span>
          <a
            href="https://github.com/CtrlAltMike/onlineredactor"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-neutral-700 underline-offset-2 hover:underline"
          >
            Source
          </a>
        </span>
        <span>Your files never leave your browser.</span>
      </div>
    </footer>
  );
}
