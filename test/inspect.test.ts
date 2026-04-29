import { describe, expect, it } from 'vitest';
import {
  formatBlockingIssues,
  inspectDocumentFeatures,
  inspectPageFeatures,
} from '@/lib/pdf/inspect';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

describe('PDF support inspection', () => {
  it('blocks fillable forms and embedded attachments', async () => {
    const doc = {
      getFieldObjects: async () => ({ ssn: [{ value: '123-45-6789' }] }),
      hasJSActions: async () => false,
      getJSActions: async () => null,
      getCalculationOrderIds: async () => null,
      getAttachments: async () => ({ secret: {} }),
    } as unknown as PDFDocumentProxy;

    const issues = await inspectDocumentFeatures(doc);

    expect(issues.map((issue) => issue.code)).toEqual([
      'form-fields',
      'attachments',
    ]);
    expect(formatBlockingIssues(issues)).toContain('fillable form fields');
  });

  it('blocks document JavaScript and calculation actions', async () => {
    const doc = {
      getFieldObjects: async () => null,
      hasJSActions: async () => true,
      getJSActions: async () => ({ OpenAction: ['app.alert()'] }),
      getCalculationOrderIds: async () => ['field-a'],
      getAttachments: async () => null,
    } as unknown as PDFDocumentProxy;

    const issues = await inspectDocumentFeatures(doc);

    expect(issues.map((issue) => issue.code)).toEqual([
      'document-javascript',
      'calculation-actions',
    ]);
  });

  it('blocks sensitive-looking document metadata', async () => {
    const doc = {
      getFieldObjects: async () => null,
      hasJSActions: async () => false,
      getJSActions: async () => null,
      getCalculationOrderIds: async () => null,
      getAttachments: async () => null,
      getMetadata: async () => ({
        info: { Title: 'Client SSN 123-45-6789' },
        metadata: new Map([['subject', 'jane@example.com']]),
      }),
    } as unknown as PDFDocumentProxy;

    const issues = await inspectDocumentFeatures(doc);

    expect(issues).toMatchObject([
      { code: 'sensitive-metadata', blocking: true },
    ]);
    expect(formatBlockingIssues(issues)).toContain('document metadata');
  });

  it('allows plain link annotations but blocks content annotations', async () => {
    const linkOnlyPage = {
      getAnnotations: async () => [{ subtype: 'Link' }],
    } as unknown as PDFPageProxy;
    const notePage = {
      getAnnotations: async () => [{ subtype: 'Text' }],
    } as unknown as PDFPageProxy;

    await expect(inspectPageFeatures(linkOnlyPage)).resolves.toEqual([]);
    await expect(inspectPageFeatures(notePage)).resolves.toMatchObject([
      { code: 'page-annotations', blocking: true },
    ]);
  });
});
