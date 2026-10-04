import QRCode from 'qrcode';

export type QrMode = 'payment' | 'portal';

export interface QrStudent {
  student_id: string;
  name_kh: string;
  grade: string | null;
  portal_token: string;
}

export async function generateQrDataUrl(text: string, size = 320): Promise<string> {
  return QRCode.toDataURL(text, {
    width: size,
    margin: 1,
    color: { dark: '#0f172a', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  });
}

export function qrTextFor(student: QrStudent, mode: QrMode): string {
  if (mode === 'payment') return student.student_id;
  const base = window.location.origin;
  return `${base}/student?t=${encodeURIComponent(student.portal_token)}`;
}

export async function makeQrCards(
  students: QrStudent[],
  mode: QrMode,
): Promise<Array<{ student: QrStudent; dataUrl: string; text: string }>> {
  return Promise.all(
    students.map(async (s) => {
      const text = qrTextFor(s, mode);
      const dataUrl = await generateQrDataUrl(text);
      return { student: s, dataUrl, text };
    }),
  );
}

// ---------------------------------------------------------------------------
// Print helpers — open a dedicated popup window with only print content.
// Avoids fighting the current page's CSS.
// ---------------------------------------------------------------------------

export interface PrintOptions {
  cards: Array<{ student: QrStudent; dataUrl: string }>;
  mode: QrMode;
  schoolName: string;
  title: string;
  subtitle?: string;
}

export function printQrCards(opts: PrintOptions): void {
  const { cards, mode, schoolName, title, subtitle } = opts;
  const win = window.open('', '_blank', 'width=900,height=760');
  if (!win) {
    alert('Pop-up blocked. Please allow pop-ups for this site.');
    return;
  }

  const modeLabel = mode === 'payment' ? 'Payment QR' : 'Portal QR';
  const hint =
    mode === 'payment'
      ? 'Staff scanning code'
      : 'Scan to view payment history';

  const cardsHtml = cards
    .map(({ student, dataUrl }) => `
      <div class="card">
        <img src="${dataUrl}" alt="QR" />
        <div class="name">${escapeHtml(student.name_kh)}</div>
        <div class="meta">
          <span class="mono">${escapeHtml(student.student_id)}</span>
          ${student.grade ? `<span>·</span><span>${escapeHtml(student.grade)}</span>` : ''}
        </div>
        <div class="hint">${escapeHtml(hint)}</div>
      </div>
    `)
    .join('');

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)} — QR</title>
    <style>
      @page { size: A4; margin: 12mm; }
      * { box-sizing: border-box; }
      body {
        font-family: 'Siemreap', 'Inter', system-ui, sans-serif;
        margin: 0;
        color: #0f172a;
      }
      .page-header {
        margin-bottom: 10mm;
        border-bottom: 1px solid #e2e8f0;
        padding-bottom: 4mm;
      }
      .page-header h1 { font-size: 16pt; margin: 0; }
      .page-header .sub { font-size: 10pt; color: #64748b; margin-top: 2px; }
      .grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6mm 4mm;
      }
      .card {
        border: 1px dashed #cbd5e1;
        border-radius: 6px;
        padding: 5mm 3mm;
        text-align: center;
        break-inside: avoid;
        page-break-inside: avoid;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .card img { width: 34mm; height: 34mm; display: block; image-rendering: crisp-edges; }
      .card .name {
        font-size: 11pt; font-weight: 600; margin-top: 3mm;
        line-height: 1.2; word-break: break-word;
      }
      .card .meta {
        font-size: 9pt; color: #475569; margin-top: 1mm;
        display: flex; gap: 3px; align-items: center; justify-content: center;
      }
      .card .mono { font-family: 'Consolas', 'Menlo', monospace; font-size: 8.5pt; }
      .card .hint {
        font-size: 8pt; color: #94a3b8; margin-top: 2mm;
      }
      .toolbar {
        position: sticky; top: 0;
        background: #f8fafc; border-bottom: 1px solid #e2e8f0;
        padding: 8px 12px; margin: -12mm -12mm 6mm -12mm;
        display: flex; justify-content: space-between; align-items: center;
        font-family: system-ui, sans-serif;
      }
      .toolbar button {
        background: #2563eb; color: #fff; border: 0;
        padding: 6px 14px; border-radius: 6px; cursor: pointer;
        font-size: 13px;
      }
      .toolbar .info { font-size: 12px; color: #475569; }
      @media print {
        .toolbar { display: none; }
        body { margin: 0; }
      }
    </style>
  </head>
  <body>
    <div class="toolbar">
      <span class="info">${cards.length} card(s) — ${escapeHtml(modeLabel)} — ${escapeHtml(schoolName)}</span>
      <button onclick="window.print()">Print</button>
    </div>

    <div class="page-header">
      <h1>${escapeHtml(title)}</h1>
      ${subtitle ? `<div class="sub">${escapeHtml(subtitle)}</div>` : ''}
    </div>

    <div class="grid">${cardsHtml}</div>

    <script>
      window.addEventListener('load', function() {
        setTimeout(function() { window.print(); }, 350);
      });
    </script>
  </body>
</html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}