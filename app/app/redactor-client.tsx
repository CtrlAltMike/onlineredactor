'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  addRedactionHistoryEntry,
  clearRedactionHistory,
  readRedactionHistory,
  type RedactionHistoryEntry,
} from '@/lib/local/redaction-history';
import {
  deleteRule,
  readSavedRules,
  saveRule,
  type SavedRule,
} from '@/lib/local/saved-rules';
import { loadPdfFromFile } from '@/lib/pdf/render';
import { pdfSizeLimitMessage } from '@/lib/pdf/limits';
import {
  readFreeUsage,
  recordFreeRedaction,
  type FreeUsageSnapshot,
} from '@/lib/usage/free-tier';
import {
  formatBlockingIssues,
  inspectDocumentFeatures,
  inspectPageFeatures,
  type PdfSupportIssue,
} from '@/lib/pdf/inspect';
import {
  coveredTextForRegions,
  detectSensitiveTextRegions,
  extractPageTextItems,
  findTextRegions,
  type PdfTextItem,
  type PdfTextRegion,
} from '@/lib/pdf/text';
import { PdfPageCanvas } from '@/components/pdf-page-canvas';

const renderScale = 1.5;
const initialUsage: FreeUsageSnapshot = {
  date: '',
  count: 0,
  limit: 3,
  remaining: 3,
  isCapped: false,
};

type CanvasTarget = {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

type PdfTarget = CanvasTarget;

export function RedactorClient() {
  const [file, setFile] = useState<File | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState<Awaited<ReturnType<PDFDocumentProxy['getPage']>>[]>([]);
  const [textItems, setTextItems] = useState<PdfTextItem[]>([]);
  const [targets, setTargets] = useState<CanvasTarget[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [unsupportedReason, setUnsupportedReason] = useState<string | null>(null);
  const [certificateText, setCertificateText] = useState<string | null>(null);
  const [usage, setUsage] = useState<FreeUsageSnapshot>(initialUsage);
  const [savedRules, setSavedRules] = useState<SavedRule[]>([]);
  const [history, setHistory] = useState<RedactionHistoryEntry[]>([]);
  const [showCapModal, setShowCapModal] = useState(false);

  useEffect(() => {
    setUsage(readFreeUsage(window.localStorage));
    setSavedRules(readSavedRules(window.localStorage));
    setHistory(readRedactionHistory(window.localStorage));
  }, []);

  useEffect(() => {
    if (file && usage.isCapped) setShowCapModal(true);
  }, [file, usage.isCapped]);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    let localDoc: PDFDocumentProxy | null = null;
    setPages([]);
    setDoc(null);
    setTargets([]);
    setTextItems([]);
    setStatus(null);
    setUnsupportedReason(null);
    setCertificateText(null);
    (async () => {
      try {
        const d = await loadPdfFromFile(file);
        if (cancelled) {
          d.destroy();
          return;
        }
        localDoc = d;
        setDoc(d);
        const ps: Awaited<ReturnType<PDFDocumentProxy['getPage']>>[] = [];
        const text: PdfTextItem[] = [];
        const issues: PdfSupportIssue[] = [
          ...(await inspectDocumentFeatures(d)),
        ];
        for (let i = 1; i <= d.numPages; i++) {
          const p = await d.getPage(i);
          if (cancelled) return;
          ps.push(p);
          issues.push(...(await inspectPageFeatures(p)));
          text.push(...(await extractPageTextItems(p, i - 1)));
        }
        if (text.length === 0) {
          issues.push({
            code: 'image-only',
            blocking: true,
            message:
              'This PDF appears to be scanned or image-only. OCR redaction is not available yet, so export is disabled.',
          });
        }
        if (!cancelled) {
          setPages(ps);
          setTextItems(text);
          setUnsupportedReason(formatBlockingIssues(issues));
        }
      } catch (error) {
        if (!cancelled) setUnsupportedReason(loadFailureMessage(error));
      }
    })();
    return () => {
      cancelled = true;
      if (localDoc) localDoc.destroy();
    };
  }, [file]);

  function pageHeight(pageIndex: number): number {
    const viewBox = pages[pageIndex]?.view;
    return viewBox ? viewBox[3] - viewBox[1] : 0;
  }

  function pdfRegionToCanvasTarget(region: PdfTextRegion): CanvasTarget | null {
    const height = pageHeight(region.page);
    if (height <= 0) return null;
    return {
      page: region.page,
      x: region.x * renderScale,
      y: (height - (region.y + region.height)) * renderScale,
      width: region.width * renderScale,
      height: region.height * renderScale,
    };
  }

  function canvasTargetToPdfTarget(target: CanvasTarget): PdfTarget | null {
    const height = pageHeight(target.page);
    if (height <= 0) return null;
    return {
      page: target.page,
      x: target.x / renderScale,
      y: height - (target.y + target.height) / renderScale,
      width: target.width / renderScale,
      height: target.height / renderScale,
    };
  }

  function addTargets(nextTargets: CanvasTarget[], label: string) {
    if (nextTargets.length === 0) {
      setStatus(`No ${label} matches found.`);
      return;
    }
    setTargets((prev) => dedupeTargets([...prev, ...nextTargets]));
    setStatus(`Added ${nextTargets.length} ${label} target${nextTargets.length === 1 ? '' : 's'}.`);
  }

  function markSearchQuery(query: string, label: string) {
    const regions = findTextRegions(textItems, query)
      .map((region) => pdfRegionToCanvasTarget(region))
      .filter((target): target is CanvasTarget => target !== null);
    addTargets(regions, label);
  }

  function applySavedRules(rules: SavedRule[]) {
    const regions = rules.flatMap((rule) => findTextRegions(textItems, rule.query))
      .map((region) => pdfRegionToCanvasTarget(region))
      .filter((target): target is CanvasTarget => target !== null);
    addTargets(regions, 'saved-rule');
  }

  function saveSearchRule() {
    const nextRules = saveRule(window.localStorage, { query: searchQuery });
    setSavedRules(nextRules);
    if (searchQuery.trim()) setStatus(`Saved "${searchQuery.trim()}" as a local rule.`);
  }

  function removeSavedRule(rule: SavedRule) {
    setSavedRules(deleteRule(window.localStorage, rule.id));
    setStatus(`Deleted saved rule "${rule.name}".`);
  }

  function chooseFile(nextFile: File | undefined) {
    if (!nextFile) return;
    const limitMessage = pdfSizeLimitMessage(nextFile.size);
    if (limitMessage) {
      setFile(null);
      setUploadError(limitMessage);
      return;
    }
    setUploadError(null);
    setFile(nextFile);
  }

  if (!file) {
    return (
      <>
        {uploadError && (
          <p
            role="alert"
            className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            {uploadError}
          </p>
        )}
        <section className="border-2 border-dashed border-neutral-300 rounded-lg p-16 text-center">
          <p className="text-lg">Drop a PDF here, or click to select.</p>
          <p className="mt-2 text-sm text-neutral-500">
            Your file is processed in your browser. It never leaves your device.
          </p>
          <input
            type="file"
            accept="application/pdf"
            aria-label="PDF file"
            className="mt-6"
            onChange={(e) => chooseFile(e.target.files?.[0])}
          />
        </section>
      </>
    );
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-600">
          Loaded: {file.name} ({doc?.numPages ?? '...'} pages)
        </p>
        <p className="text-sm text-neutral-600">
          {targets.length} target{targets.length === 1 ? '' : 's'} selected
        </p>
      </div>

      {unsupportedReason && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          {unsupportedReason}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-md border border-neutral-200 p-4">
        <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm">
          <span className="font-medium">Find text</span>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-md border border-neutral-300 px-3 py-2"
            placeholder="SSN, name, email, case number"
            disabled={Boolean(unsupportedReason)}
          />
        </label>
        <button
          className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:bg-neutral-300"
          disabled={Boolean(unsupportedReason) || !searchQuery.trim()}
          onClick={() => markSearchQuery(searchQuery, 'search')}
        >
          Mark matches
        </button>
        <button
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm disabled:text-neutral-400"
          disabled={!searchQuery.trim()}
          onClick={saveSearchRule}
        >
          Save rule
        </button>
        <button
          className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:bg-neutral-300"
          disabled={Boolean(unsupportedReason) || textItems.length === 0}
          onClick={() => {
            const regions = detectSensitiveTextRegions(textItems)
              .map((region) => pdfRegionToCanvasTarget(region))
              .filter((target): target is CanvasTarget => target !== null);
            addTargets(regions, 'auto-detect');
          }}
        >
          Auto-detect
        </button>
        <button
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm disabled:text-neutral-400"
          disabled={targets.length === 0}
          onClick={() => {
            setTargets([]);
            setStatus('Cleared all targets.');
          }}
        >
          Clear
        </button>
      </div>

      <section className="mt-4 rounded-md border border-neutral-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Saved local rules</h2>
          <button
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:text-neutral-400"
            disabled={Boolean(unsupportedReason) || savedRules.length === 0}
            onClick={() => applySavedRules(savedRules)}
          >
            Apply all
          </button>
        </div>
        {savedRules.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-600">
            Save repeat searches like an SSN, case number, or account number.
            Rules stay in this browser only.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {savedRules.map((rule) => (
              <li
                key={rule.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-neutral-50 px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-medium">{rule.name}</span>
                  <span className="ml-2 text-neutral-500">{rule.query}</span>
                </span>
                <span className="flex gap-2">
                  <button
                    className="rounded-md border border-neutral-300 px-3 py-1.5 disabled:text-neutral-400"
                    disabled={Boolean(unsupportedReason)}
                    onClick={() => markSearchQuery(rule.query, 'saved-rule')}
                  >
                    Apply
                  </button>
                  <button
                    className="rounded-md border border-neutral-300 px-3 py-1.5"
                    onClick={() => removeSavedRule(rule)}
                  >
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {status && <p className="mt-3 text-sm text-neutral-600">{status}</p>}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
        <p>
          Free redactions today: {usage.count}/{usage.limit}
        </p>
        {usage.isCapped ? (
          <Link href="/upgrade" className="underline underline-offset-4">
            Upgrade options
          </Link>
        ) : (
          <p>{usage.remaining} remaining before the local free-tier pause.</p>
        )}
      </div>

      {usage.isCapped && (
        <p
          role="alert"
          className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          You have used today&apos;s 3 free verified redactions in this browser.
          Paid checkout is paused, so exports are paused until the local counter
          resets tomorrow.
        </p>
      )}

      <button
        className="mt-4 rounded-md bg-black text-white px-4 py-2 text-sm disabled:bg-neutral-300"
        disabled={Boolean(unsupportedReason) || targets.length === 0 || usage.isCapped}
        onClick={async () => {
          try {
            if (!file || !doc) return;
            const currentUsage = readFreeUsage(window.localStorage);
            if (currentUsage.isCapped) {
              setUsage(currentUsage);
              setShowCapModal(true);
              return;
            }
            const bytes = new Uint8Array(await file.arrayBuffer());
            const { applyRedactions } = await import('@/lib/pdf/apply');
            const {
              buildVerificationCertificate,
              formatVerificationCertificate,
            } = await import('@/lib/pdf/certificate');
            const { verifyRedactions, verifyRedactionRegions } = await import(
              '@/lib/pdf/verify'
            );

            // Convert each canvas-space target to PDF space. Viewport scale = 1.5
            // (must match PdfPageCanvas' default in lib/pdf/render.ts).
            // While we're there, estimate the text fragments that fall inside
            // each box. Verification checks those fragments, then separately
            // confirms no extractable text remains inside the redaction boxes.
            const pdfTargets = targets
              .map((target) => canvasTargetToPdfTarget(target))
              .filter((target): target is PdfTarget => target !== null);
            const seeded = coveredTextForRegions(textItems, pdfTargets);

            const result = await applyRedactions(bytes, pdfTargets);

            if (targets.length > 0 && seeded.length === 0) {
              alert(
                "We couldn't extract text from the region you selected, so the export was blocked. This can happen with scanned/image PDFs, unusual fonts, or non-text content. Nothing was downloaded."
              );
              return;
            }

            const stringVerify = await verifyRedactions(result.bytes, seeded);
            const regionVerify = await verifyRedactionRegions(
              result.bytes,
              pdfTargets
            );
            const leaked = [...stringVerify.leaked, ...regionVerify.leaked];
            if (!stringVerify.ok || !regionVerify.ok) {
              alert(
                `Verification failed — redaction did not remove the following text, so the file was NOT downloaded:\n\n${leaked.join(
                  '\n'
                )}`
              );
              return;
            }

            const blob = new Blob([new Uint8Array(result.bytes)], {
              type: 'application/pdf',
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name.replace(/\.pdf$/i, '') + '.redacted.pdf';
            a.click();
            URL.revokeObjectURL(url);
            const certificate = buildVerificationCertificate({
              outputSha256: result.sha256,
              pageCount: result.pageCount,
              regionCount: result.regionCount,
              verifiedStringCount: seeded.length,
              verifiedRegionCount: pdfTargets.length,
            });
            setCertificateText(formatVerificationCertificate(certificate));
            setStatus(
              'Verified redaction complete. Download started. Verification certificate is ready.'
            );
            const nextUsage = recordFreeRedaction(window.localStorage);
            setUsage(nextUsage);
            if (nextUsage.isCapped) setShowCapModal(true);
            setHistory(
              addRedactionHistoryEntry(window.localStorage, {
                outputSha256: result.sha256,
                pageCount: result.pageCount,
                regionCount: result.regionCount,
                verifiedStringCount: seeded.length,
              })
            );
          } catch (e) {
            alert(
              `Redaction failed: ${
                e instanceof Error ? e.message : 'unknown error'
              }\n\nNothing was downloaded.`
            );
            console.error(e);
          }
        }}
      >
        Redact &amp; download
      </button>
      {showCapModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="free-cap-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
        >
          <section className="w-full max-w-md rounded-md bg-white p-6 shadow-xl">
            <h2 id="free-cap-title" className="text-lg font-semibold">
              Free redactions paused
            </h2>
            <p className="mt-3 text-sm text-neutral-700">
              This browser has used today&apos;s 3 free verified redactions.
              Paid checkout is paused while the product stays in safety review,
              so exports resume when the local counter resets tomorrow.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm"
                onClick={() => setShowCapModal(false)}
              >
                Close
              </button>
              <Link
                href="/upgrade"
                className="rounded-md bg-black px-4 py-2 text-sm text-white"
              >
                Upgrade options
              </Link>
            </div>
          </section>
        </div>
      )}
      {certificateText && (
        <section
          aria-label="Verification certificate"
          className="mt-4 rounded-md border border-neutral-200 p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Verification certificate</h2>
            <button
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
              onClick={() => downloadTextFile(certificateText, 'redaction-certificate.txt')}
            >
              Download certificate
            </button>
          </div>
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-neutral-50 p-3 text-xs text-neutral-700">
            {certificateText}
          </pre>
        </section>
      )}
      <section className="mt-4 rounded-md border border-neutral-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Local history</h2>
          <button
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:text-neutral-400"
            disabled={history.length === 0}
            onClick={() => setHistory(clearRedactionHistory(window.localStorage))}
          >
            Clear history
          </button>
        </div>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-600">
            Successful exports will appear here with content-free proof details.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {history.map((entry) => (
              <li key={entry.id} className="rounded-md bg-neutral-50 p-3">
                <p className="font-medium">
                  {new Date(entry.createdAt).toLocaleString()}
                </p>
                <p className="mt-1 text-neutral-600">
                  {entry.pageCount} page{entry.pageCount === 1 ? '' : 's'}, {entry.regionCount}{' '}
                  region{entry.regionCount === 1 ? '' : 's'}, SHA-256{' '}
                  {entry.outputSha256.slice(0, 12)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="mt-4 space-y-4">
        {pages.map((p, i) => (
          <PdfPageCanvas
            key={`${file.name}-${i}`}
            page={p}
            pageIndex={i}
            existing={targets.filter((t) => t.page === i)}
            onCommit={(t) => setTargets((prev) => [...prev, t])}
          />
        ))}
      </div>
    </section>
  );
}

function loadFailureMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/password/i.test(message)) {
    return 'This PDF is encrypted or password-protected. Password-protected PDFs are not supported for verified export yet.';
  }
  return `This PDF could not be loaded for verified redaction. ${message}`;
}

function downloadTextFile(text: string, filename: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function dedupeTargets(targets: CanvasTarget[]): CanvasTarget[] {
  const seen = new Set<string>();
  return targets.filter((target) => {
    const key = [
      target.page,
      Math.round(target.x),
      Math.round(target.y),
      Math.round(target.width),
      Math.round(target.height),
    ].join(':');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
