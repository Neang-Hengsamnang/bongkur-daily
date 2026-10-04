// ---------------------------------------------------------------------------
// Excel export with formula support
//
// Formulas are written as real Excel formulas, not computed values, so the
// user can edit inputs in Excel and see derived cells update automatically.
//
// Template placeholders:
//   {row}         → Excel row number of the current cell
//   {firstRow}    → first data row number        (totals formulas only)
//   {lastRow}     → last data row number         (totals formulas only)
//   {col:key}     → column letter for a given column key (survives reorder)
//
// Leading '=' is optional and stripped before writing.
// ---------------------------------------------------------------------------

type CellValue = string | number | null | undefined;

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  /** Excel number format, e.g. '#,##0 "៛"' */
  format?: string;
  /**
   * If set, the data cell for this column is written as an Excel formula
   * (the row value for this key is ignored).
   * Example: '={col:total}{row}-{col:paid}{row}'
   */
  formula?: string;
  /** ARGB fill for the header cell (overrides default blue) */
  headerFill?: string;
  /** ARGB fill for data cells (overrides zebra striping) */
  dataFill?: string;
}

export interface ExcelExportOptions {
  filename: string;
  sheetName?: string;
  title?: string;
  subtitle?: string;
  columns: ExcelColumn[];
  rows: Record<string, CellValue>[];
  /**
   * Optional totals row. Each entry is either a static value or
   * `{ formula }` using the placeholder syntax above.
   */
  totals?: Record<string, CellValue | { formula: string }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function colLetter(i: number): string {
  let s = '';
  let n = i + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function expand(
  template: string,
  rowNum: number,
  letters: Map<string, string>,
  firstRow?: number,
  lastRow?: number,
  totalsRow?: number,
): string {
  let out = template.replace(/\{col:(\w+)\}/g, (_m, k: string) => letters.get(k) ?? '?');
  out = out.replace(/\{row\}/g, String(rowNum));
  if (firstRow  !== undefined) out = out.replace(/\{firstRow\}/g,  String(firstRow));
  if (lastRow   !== undefined) out = out.replace(/\{lastRow\}/g,   String(lastRow));
  if (totalsRow !== undefined) out = out.replace(/\{totalRow\}/g,  String(totalsRow));
  return out.replace(/^=/, '');
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function exportExcel(opts: ExcelExportOptions): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Student Daily Payment';
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;

  const ws = wb.addWorksheet(opts.sheetName ?? 'Report', {
    views: [{ state: 'frozen', ySplit: opts.title || opts.subtitle ? 4 : 1 }],
    pageSetup: {
      orientation: opts.columns.length > 6 ? 'landscape' : 'portrait',
      fitToPage: true,
    },
  });

  ws.columns = opts.columns.map((c) => ({ key: c.key, width: c.width ?? 18 }));

  const letters = new Map<string, string>();
  opts.columns.forEach((c, i) => letters.set(c.key, colLetter(i)));

  let rowIdx = 1;

  // ---- Title
  if (opts.title) {
    const r = ws.getRow(rowIdx++);
    r.getCell(1).value = opts.title;
    ws.mergeCells(r.number, 1, r.number, opts.columns.length);
    r.getCell(1).font = { bold: true, size: 15, color: { argb: 'FF0F172A' } };
    r.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    r.height = 24;
  }

  // ---- Subtitle
  if (opts.subtitle) {
    const r = ws.getRow(rowIdx++);
    r.getCell(1).value = opts.subtitle;
    ws.mergeCells(r.number, 1, r.number, opts.columns.length);
    r.getCell(1).font = { size: 10, italic: true, color: { argb: 'FF64748B' } };
    r.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    r.height = 18;
  }

  // ---- Spacer
  if (opts.title || opts.subtitle) {
    ws.getRow(rowIdx++).height = 6;
  }

  // ---- Header
  const headerRow = ws.getRow(rowIdx++);
  opts.columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = c.headerFill
        ? { type: 'pattern', pattern: 'solid', fgColor: { argb: c.headerFill } }
        : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    cell.alignment = { vertical: 'middle', horizontal: c.align ?? 'left', wrapText: true };
    cell.border = {
      top:    { style: 'thin', color: { argb: 'FF1E40AF' } },
      bottom: { style: 'thin', color: { argb: 'FF1E40AF' } },
      left:   { style: 'thin', color: { argb: 'FF1E40AF' } },
      right:  { style: 'thin', color: { argb: 'FF1E40AF' } },
    };
  });
  headerRow.height = 24;

  // ---- Data rows
  const firstDataRow = rowIdx;
  const lastDataRow  = firstDataRow + opts.rows.length - 1;
  const totalsRowNum = opts.totals ? lastDataRow + 1 : undefined;

  opts.rows.forEach((data, idx) => {
    const r = ws.getRow(rowIdx);
    opts.columns.forEach((c, i) => {
      const cell = r.getCell(i + 1);

      if (c.formula) {
        const f = expand(c.formula, rowIdx, letters, firstDataRow, lastDataRow, totalsRowNum);
        cell.value = { formula: f } as unknown as typeof cell.value;
      } else {
        const v = data[c.key];
        cell.value = (v ?? '') as string | number;
      }

      cell.alignment = { vertical: 'middle', horizontal: c.align ?? 'left' };
      if (c.format) cell.numFmt = c.format;
      if (c.dataFill) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.dataFill } };
      } else if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
    });
    rowIdx++;
  });

  // ---- Totals row
  if (opts.totals) {
    const totalsRowNum = rowIdx;
    const r = ws.getRow(rowIdx++);

    opts.columns.forEach((c, i) => {
      const cell = r.getCell(i + 1);
      const spec = opts.totals![c.key];

      if (spec && typeof spec === 'object' && 'formula' in spec) {
        const f = expand(
          spec.formula, totalsRowNum, letters, firstDataRow, lastDataRow,
        );
        cell.value = { formula: f } as unknown as typeof cell.value;
      } else if (spec !== undefined) {
        cell.value = spec as string | number;
      }

      cell.font = { bold: true, color: { argb: 'FF0F172A' } };
      cell.alignment = { vertical: 'middle', horizontal: c.align ?? 'left' };
      if (c.format) cell.numFmt = c.format;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
      cell.border = { top: { style: 'medium', color: { argb: 'FF1E40AF' } } };
    });
    r.height = 22;
  }

  // ---- Write file
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = opts.filename.endsWith('.xlsx') ? opts.filename : `${opts.filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}