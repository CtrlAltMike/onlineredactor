# Phase 2 Fixture Corpus + QA

Phase 2 keeps paid checkout paused and proves the redactor against representative PDF shapes before V1 launch.

## Automated Fixture Matrix

Run with:

```sh
npm run fixtures
npm run e2e
```

| Fixture | Expected result | Covered risk |
| --- | --- | --- |
| `plain-ssn.pdf` | Supported export | Basic selectable PDF text |
| `multi-page.pdf` | Supported export | Redaction on non-first pages |
| `standard-fonts.pdf` | Supported export | PDF standard fonts |
| `embedded-font.pdf` | Supported export | Embedded custom font text extraction |
| `rotated-page.pdf` | Supported export | Page rotation coordinate mapping |
| `cropped-page.pdf` | Supported export | Crop box coordinate mapping |
| `mixed-orientation.pdf` | Supported export | Portrait and landscape pages in one file |
| `non-latin.pdf` | Supported export | Non-Latin searchable text |
| `form-field.pdf` | Blocked | AcroForm/widget content is not verified yet |
| `annotation-text.pdf` | Blocked | Annotation content is not verified yet |
| `metadata-sensitive.pdf` | Blocked | Sensitive-looking metadata is not scrubbed yet |
| `encrypted.pdf` | Blocked | Password-protected PDFs are unsupported |
| `scanned-image-only.pdf` | Blocked | Image-only PDFs need OCR before redaction |
| `ocr-like-image.pdf` | Blocked | Visible image text needs OCR before redaction |

## Manual QA Checklist

For each supported exported fixture:

1. Open the downloaded PDF in Chrome, macOS Preview, and Adobe Reader.
2. Select all text and copy/paste into a plain text editor.
3. Search the exported PDF for the redacted token.
4. Confirm the redacted token is absent and public surrounding text remains readable.
5. Record the app-generated certificate hash, timestamp, page count, region count, and verification status.

For each blocked fixture:

1. Load the fixture in the app.
2. Confirm a blocking warning appears.
3. Confirm `Redact & download` is disabled.
4. Confirm no PDF download occurs.

Manual QA should be recorded before launch because automated Playwright coverage cannot validate Adobe Reader and Preview behavior.
