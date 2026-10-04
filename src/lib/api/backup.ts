import { supabase } from '../supabase';
import { riel } from '../format';
import JSZip from 'jszip';

// ---------------------------------------------------------------------------
// Fetch everything (owner-only via RLS)
// ---------------------------------------------------------------------------

export interface BackupPayload {
  courses: Record<string, unknown>[];
  users: Record<string, unknown>[];
  students: Record<string, unknown>[];
  payments: Record<string, unknown>[];
  paymentItems: Record<string, unknown>[];
  settings: Record<string, unknown>[];
}

async function fetchAll(table: string, order?: { col: string; asc?: boolean }) {
  const PAGE = 1000;
  let from = 0;
  const out: Record<string, unknown>[] = [];

  while (true) {
    let q = supabase.from(table).select('*').range(from, from + PAGE - 1);
    if (order) q = q.order(order.col, { ascending: order.asc ?? true });
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

export async function fetchBackupPayload(): Promise<BackupPayload> {
  const [
    courses, users, students, payments, paymentItems, settings,
  ] = await Promise.all([
    fetchAll('courses', { col: 'course_id', asc: true }),
    fetchAll('profiles', { col: 'user_id', asc: true }),
    fetchAll('students', { col: 'student_id', asc: true }),
    fetchAll('payments', { col: 'payment_id', asc: true }),
    fetchAll('payment_items', { col: 'item_id', asc: true }),
    fetchAll('settings', { col: 'key', asc: true }),
  ]);
  return { courses, users, students, payments, paymentItems, settings };
}

// ---------------------------------------------------------------------------
// Column schemas — keep names identical to Google Sheets
// ---------------------------------------------------------------------------

type Col = {
  header: string;
  key: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  format?: string;
};

const COLS_USERS: Col[] = [
  { header: 'user_id',   key: 'user_id',   width: 12, align: 'left' },
  { header: 'username',  key: 'username',  width: 16, align: 'left' },
  { header: 'role',      key: 'role',      width: 10, align: 'center' },
  { header: 'full_name', key: 'full_name', width: 22, align: 'left' },
  { header: 'email',     key: 'email',     width: 26, align: 'left' },
  { header: 'is_active', key: 'is_active', width: 10, align: 'center' },
  { header: 'last_login',   key: 'last_login',   width: 20, align: 'left' },
  { header: 'created_at',   key: 'created_at',   width: 20, align: 'left' },
  { header: 'updated_at',   key: 'updated_at',   width: 20, align: 'left' },
  { header: 'created_by',   key: 'created_by',   width: 12, align: 'left' },
];

const COLS_COURSES: Col[] = [
  { header: 'course_id',  key: 'course_id',  width: 12, align: 'left' },
  { header: 'name_kh',    key: 'name_kh',    width: 22, align: 'left' },
  { header: 'name_en',    key: 'name_en',    width: 20, align: 'left' },
  { header: 'hourly_fee', key: 'hourly_fee', width: 14, align: 'right', format: '#,##0' },
  { header: 'status',     key: 'status',     width: 10, align: 'center' },
  { header: 'created_at', key: 'created_at', width: 20, align: 'left' },
  { header: 'updated_at', key: 'updated_at', width: 20, align: 'left' },
];

const COLS_STUDENTS: Col[] = [
  { header: 'student_id',    key: 'student_id',    width: 12, align: 'left' },
  { header: 'name_kh',       key: 'name_kh',       width: 22, align: 'left' },
  { header: 'gender',        key: 'gender',        width: 10, align: 'center' },
  { header: 'date_of_birth', key: 'date_of_birth', width: 14, align: 'center' },
  { header: 'grade',         key: 'grade',         width: 12, align: 'left' },
  { header: 'course',        key: 'course',        width: 12, align: 'left' },
  { header: 'status',        key: 'status',        width: 12, align: 'center' },
  { header: 'portal_token',  key: 'portal_token',  width: 28, align: 'left' },
  { header: 'created_at',    key: 'created_at',    width: 20, align: 'left' },
  { header: 'updated_at',    key: 'updated_at',    width: 20, align: 'left' },
  { header: 'created_by',    key: 'created_by',    width: 12, align: 'left' },
];

const COLS_PAYMENTS: Col[] = [
  { header: 'payment_id',   key: 'payment_id',   width: 12, align: 'left' },
  { header: 'student_id',   key: 'student_id',   width: 12, align: 'left' },
  { header: 'payment_date', key: 'payment_date', width: 14, align: 'center' },
  { header: 'is_paid',      key: 'is_paid',      width: 10, align: 'center' },
  { header: 'paid_amount',  key: 'paid_amount',  width: 14, align: 'right', format: '#,##0' },
  { header: 'total_amount', key: 'total_amount', width: 14, align: 'right', format: '#,##0' },
  { header: 'remaining',    key: 'remaining',    width: 14, align: 'right', format: '#,##0',
    // Excel formula: total - paid
  },
  { header: 'recorded_by',  key: 'recorded_by',  width: 12, align: 'left' },
  { header: 'note',         key: 'note',         width: 30, align: 'left' },
  { header: 'created_at',   key: 'created_at',   width: 20, align: 'left' },
  { header: 'updated_at',   key: 'updated_at',   width: 20, align: 'left' },
  { header: 'paid_at',      key: 'paid_at',      width: 20, align: 'left' },
];

const COLS_ITEMS: Col[] = [
  { header: 'item_id',             key: 'item_id',             width: 12, align: 'left' },
  { header: 'payment_id',          key: 'payment_id',          width: 12, align: 'left' },
  { header: 'course_id',           key: 'course_id',           width: 12, align: 'left' },
  { header: 'course_name_at_time', key: 'course_name_at_time', width: 22, align: 'left' },
  { header: 'hours',               key: 'hours',               width: 10, align: 'center' },
  { header: 'hourly_fee_at_time',  key: 'hourly_fee_at_time',  width: 14, align: 'right', format: '#,##0' },
  { header: 'subtotal',            key: 'subtotal',            width: 14, align: 'right', format: '#,##0' },
];

const COLS_SETTINGS: Col[] = [
  { header: 'key',        key: 'key',        width: 24, align: 'left' },
  { header: 'value',      key: 'value',      width: 40, align: 'left' },
  { header: 'updated_at', key: 'updated_at', width: 20, align: 'left' },
  { header: 'updated_by', key: 'updated_by', width: 12, align: 'left' },
];

// ---------------------------------------------------------------------------
// Excel builder — one sheet per table
// ---------------------------------------------------------------------------

export async function downloadFullBackup(): Promise<void> {
  const data = await fetchBackupPayload();
  const ExcelJS = (await import('exceljs')).default;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Student Daily Payment';
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;

  const now = new Date();
  const stamp =
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}` +
    `_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

  addSheet(wb, 'Courses',        COLS_COURSES,   data.courses);
  addSheet(wb, 'Students',       COLS_STUDENTS,  data.students);
  addSheet(wb, 'Users',          COLS_USERS,     data.users);
  addSheet(wb, 'Payments',       COLS_PAYMENTS,  data.payments);
  addSheet(wb, 'PaymentItems',   COLS_ITEMS,     data.paymentItems);
  addSheet(wb, 'Settings',       COLS_SETTINGS,  data.settings);

  // Metadata sheet
  const meta = wb.addWorksheet('_Meta');
  meta.columns = [
    { header: 'Field', key: 'field', width: 24 },
    { header: 'Value', key: 'value', width: 40 },
  ];
  meta.getRow(1).font = { bold: true };
  meta.addRow({ field: 'Exported at',       value: now.toISOString() });
  meta.addRow({ field: 'Courses',           value: data.courses.length });
  meta.addRow({ field: 'Students',          value: data.students.length });
  meta.addRow({ field: 'Users',             value: data.users.length });
  meta.addRow({ field: 'Payments',          value: data.payments.length });
  meta.addRow({ field: 'Payment Items',     value: data.paymentItems.length });
  meta.addRow({ field: 'Total Billed',      value: riel(data.payments.reduce((s, p) => s + Number(p.total_amount ?? 0), 0)) });
  meta.addRow({ field: 'Total Paid',        value: riel(data.payments.reduce((s, p) => s + Number(p.paid_amount  ?? 0), 0)) });
  meta.addRow({ field: 'Source',            value: 'bongkur-daily' });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bongkur-daily-backup-${stamp}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Sheet builder
// ---------------------------------------------------------------------------

function addSheet(
  wb: { addWorksheet: (name: string) => import('exceljs').Worksheet },
  name: string,
  cols: Col[],
  rows: Record<string, unknown>[],
): void {
  const ws = wb.addWorksheet(name);
  ws.columns = cols.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 18 }));
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  // Style header
  const headerRow = ws.getRow(1);
  cols.forEach((_c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = {
      top:    { style: 'thin', color: { argb: 'FF1E40AF' } },
      bottom: { style: 'thin', color: { argb: 'FF1E40AF' } },
      left:   { style: 'thin', color: { argb: 'FF1E40AF' } },
      right:  { style: 'thin', color: { argb: 'FF1E40AF' } },
    };
  });
  headerRow.height = 22;

  // Data
  rows.forEach((r, idx) => {
    const excelRow = ws.addRow(r);
    excelRow.eachCell((cell, colNumber) => {
      const col = cols[colNumber - 1];
      cell.alignment = { vertical: 'middle', horizontal: col.align ?? 'left' };
      if (col.format && typeof cell.value === 'number') cell.numFmt = col.format;
      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
    });

    // Special-case: Payments.Remaining column = Excel formula
    if (name === 'Payments') {
      const totalCol = findColLetter(cols, 'total_amount');
      const paidCol  = findColLetter(cols, 'paid_amount');
      const excelRowNum = excelRow.number;
      const remCell = excelRow.getCell(cols.findIndex((c) => c.key === 'remaining') + 1);
      remCell.value = {
        formula: `${totalCol}${excelRowNum}-${paidCol}${excelRowNum}`,
      } as unknown as typeof remCell.value;
    }
  });

  // Totals row for numeric columns (Payments, PaymentItems)
  if (name === 'Payments' || name === 'PaymentItems') {
    const numericCols = cols
      .map((c, i) => ({ c, i }))
      .filter(({ c }) =>
        ['total_amount', 'paid_amount', 'remaining', 'hours', 'subtotal'].includes(c.key),
      );

    const totalRow = ws.addRow({});
    cols.forEach((c, i) => {
      const cell = totalRow.getCell(i + 1);
      if (numericCols.some((nc) => nc.i === i)) {
        const colLetter = findColLetter(cols, c.key);
        cell.value = {
          formula: `SUM(${colLetter}2:${colLetter}${totalRow.number - 1})`,
        } as unknown as typeof cell.value;
        if (c.format) cell.numFmt = c.format;
      } else if (i === 0) {
        cell.value = 'TOTAL';
      }
      cell.font = { bold: true, color: { argb: 'FF0F172A' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
      cell.alignment = { vertical: 'middle', horizontal: c.align ?? 'left' };
      cell.border = { top: { style: 'medium', color: { argb: 'FF1E40AF' } } };
    });
  }
}

function findColLetter(cols: Col[], key: string): string {
  const idx = cols.findIndex((c) => c.key === key);
  if (idx < 0) return '?';
  let s = '';
  let n = idx + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// ---------------------------------------------------------------------------
// CSV bundle export — produces a ZIP of individual .csv files
// ---------------------------------------------------------------------------

/** Column keys to skip when writing CSV (derived / not imported). */
const CSV_SKIP_KEYS = new Set(['remaining']);

function escapeCsv(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(cols: Col[], rows: Record<string, unknown>[]): string {
  const usable = cols.filter((c) => !CSV_SKIP_KEYS.has(c.key));
  const headers = usable.map((c) => c.header).join(',');
  const lines = [headers];
  for (const r of rows) {
    lines.push(usable.map((c) => escapeCsv(r[c.key])).join(','));
  }
  // UTF-8 BOM so Excel opens Khmer text correctly
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

export async function downloadCsvBundle(): Promise<void> {
  const data = await fetchBackupPayload();

  const zip = new JSZip();
  zip.file('courses.csv',       toCsv(COLS_COURSES,  data.courses));
  zip.file('students.csv',      toCsv(COLS_STUDENTS, data.students));
  zip.file('users.csv',         toCsv(COLS_USERS,    data.users));
  zip.file('payments.csv',      toCsv(COLS_PAYMENTS, data.payments));
  zip.file('payment_items.csv', toCsv(COLS_ITEMS,    data.paymentItems));
  zip.file('settings.csv',      toCsv(COLS_SETTINGS, data.settings));

  const now = new Date();
  const stamp =
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}` +
    `_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

  zip.file(
    'README.txt',
    [
      'Full CSV backup — bongkur-daily',
      `Exported: ${now.toISOString()}`,
      '',
      'To restore: Settings → Import Data',
      '  1. Unzip this file.',
      '  2. Upload each CSV to the matching slot.',
      '  3. Set a default password for imported users (they will need to change it).',
      '  4. Check "Clear existing data" if you want a clean restore.',
      '',
      `Row counts: courses=${data.courses.length} students=${data.students.length} ` +
        `users=${data.users.length} payments=${data.payments.length} ` +
        `items=${data.paymentItems.length}`,
      '',
      'Note: payment_items.csv uses the header "payment_items.csv" as the filename',
      'and the "course_name_at_time" column — matching the import mapper.',
    ].join('\n'),
  );

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bongkur-daily-csv-backup-${stamp}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}