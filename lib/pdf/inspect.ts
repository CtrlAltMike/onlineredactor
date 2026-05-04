import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

export type PdfSupportIssueCode =
  | 'attachments'
  | 'calculation-actions'
  | 'document-javascript'
  | 'document-metadata'
  | 'form-fields'
  | 'image-only'
  | 'page-annotations';

export type PdfSupportIssue = {
  code: PdfSupportIssueCode;
  message: string;
  blocking: boolean;
};

type PdfFieldObjects = Record<string, unknown[]> | null;
type PdfAnnotation = {
  subtype?: string;
};

type PdfMetadata = {
  info?: Record<string, unknown>;
  metadata?: {
    getRaw?: () => unknown;
    [Symbol.iterator]?: () => IterableIterator<[string, unknown]>;
  } | null;
};

const userMetadataInfoKeys = new Set([
  'Title',
  'Author',
  'Subject',
  'Keywords',
]);

export async function inspectDocumentFeatures(
  doc: PDFDocumentProxy
): Promise<PdfSupportIssue[]> {
  const issues: PdfSupportIssue[] = [];

  const fields = await optional(() => doc.getFieldObjects());
  if (hasFieldObjects(fields)) {
    issues.push({
      code: 'form-fields',
      blocking: true,
      message:
        'This PDF contains fillable form fields. Form-field redaction is not verified yet, so export is disabled.',
    });
  }

  const hasJavaScript = await optional(() => doc.hasJSActions());
  const jsActions = await optional(() => doc.getJSActions());
  if (hasJavaScript || hasObjectEntries(jsActions)) {
    issues.push({
      code: 'document-javascript',
      blocking: true,
      message:
        'This PDF contains document JavaScript. Scripted PDFs are not supported for verified export yet.',
    });
  }

  const calculationOrder = await optional(() => doc.getCalculationOrderIds());
  if (Array.isArray(calculationOrder) && calculationOrder.length > 0) {
    issues.push({
      code: 'calculation-actions',
      blocking: true,
      message:
        'This PDF contains form calculation actions. Calculated forms are not supported for verified export yet.',
    });
  }

  const attachments = await optional(() => doc.getAttachments());
  if (hasObjectEntries(attachments)) {
    issues.push({
      code: 'attachments',
      blocking: true,
      message:
        'This PDF contains embedded attachments. Attachment redaction is not verified yet, so export is disabled.',
    });
  }

  const metadata = await optional(() => doc.getMetadata());
  if (metadataHasUserText(metadata as PdfMetadata | null)) {
    issues.push({
      code: 'document-metadata',
      blocking: true,
      message:
        'This PDF contains document metadata that may include hidden document text. Metadata stripping is not verified for this input yet, so export is disabled.',
    });
  }

  return dedupeIssues(issues);
}

export async function inspectPageFeatures(
  page: PDFPageProxy
): Promise<PdfSupportIssue[]> {
  const annotations = await optional(() =>
    page.getAnnotations({ intent: 'any' })
  );
  if (!Array.isArray(annotations)) return [];

  const unsupported = (annotations as PdfAnnotation[]).filter(
    (annotation) => annotation.subtype
  );
  if (unsupported.length === 0) return [];

  const hasWidget = unsupported.some(
    (annotation) => annotation.subtype === 'Widget'
  );
  return [
    {
      code: 'page-annotations',
      blocking: true,
      message: hasWidget
        ? 'This PDF contains fillable form fields or widgets. Form-field redaction is not verified yet, so export is disabled.'
        : 'This PDF contains annotations, including links or hidden annotation payloads. Annotation redaction is not verified yet, so export is disabled.',
    },
  ];
}

export function formatBlockingIssues(issues: PdfSupportIssue[]): string | null {
  const blocking = issues.filter((issue) => issue.blocking);
  if (blocking.length === 0) return null;
  return blocking.map((issue) => issue.message).join(' ');
}

async function optional<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch {
    return null;
  }
}

function hasFieldObjects(fields: PdfFieldObjects): boolean {
  return Boolean(
    fields &&
      Object.values(fields).some(
        (fieldList) => Array.isArray(fieldList) && fieldList.length > 0
      )
  );
}

function hasObjectEntries(value: unknown): boolean {
  return Boolean(
    value &&
      typeof value === 'object' &&
      Object.keys(value as Record<string, unknown>).length > 0
  );
}

function metadataHasUserText(metadata: PdfMetadata | null): boolean {
  if (!metadata) return false;
  return collectUserMetadataValues(metadata).some((value) => value.trim().length > 0);
}

function collectUserMetadataValues(metadata: PdfMetadata): string[] {
  const values: string[] = [];
  if (metadata.info) {
    for (const [key, value] of Object.entries(metadata.info)) {
      if (userMetadataInfoKeys.has(key)) collectUnknownMetadata(value, values);
    }
  }

  const parsedMetadata = metadata.metadata;
  const iterator = parsedMetadata?.[Symbol.iterator];
  if (iterator) {
    for (const [key, value] of iterator.call(parsedMetadata)) {
      values.push(String(key));
      collectUnknownMetadata(value, values);
    }
  }

  if (parsedMetadata?.getRaw) {
    collectUnknownMetadata(parsedMetadata.getRaw(), values);
  }

  return values;
}

function collectUnknownMetadata(value: unknown, values: string[]) {
  if (typeof value === 'string') {
    values.push(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectUnknownMetadata(entry, values));
    return;
  }
  if (value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach((entry) =>
      collectUnknownMetadata(entry, values)
    );
  }
}

function dedupeIssues(issues: PdfSupportIssue[]): PdfSupportIssue[] {
  const seen = new Set<PdfSupportIssueCode>();
  return issues.filter((issue) => {
    if (seen.has(issue.code)) return false;
    seen.add(issue.code);
    return true;
  });
}
