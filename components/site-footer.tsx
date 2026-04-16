export function SiteFooter() {
  return (
    <footer className="border-t border-neutral-200 mt-16">
      <div className="max-w-5xl mx-auto px-4 py-8 text-xs text-neutral-500 flex items-center justify-between">
        <span>© {new Date().getFullYear()} OnlineRedactor</span>
        <span>Your files never leave your browser.</span>
      </div>
    </footer>
  );
}
