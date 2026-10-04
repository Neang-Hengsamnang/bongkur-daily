import Papa from 'papaparse';
import { supabase } from '../supabase';

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

export async function parseCsvFile(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim(),
      complete: (result) => {
        if (result.errors.length > 0) {
          reject(new Error(result.errors.map((e) => e.message).join('; ')));
          return;
        }
        const rows = result.data.map((r) => {
          const clean: Record<string, string> = {};
          for (const [k, v] of Object.entries(r)) {
            clean[k] = typeof v === 'string' ? v.trim() : String(v ?? '');
          }
          return clean;
        });
        resolve(rows);
      },
      error: (err) => reject(err),
    });
  });
}

// ---------------------------------------------------------------------------
// Coercion
// ---------------------------------------------------------------------------

const emptyToNull = (v: string | undefined): string | null => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

const toInt = (v: string | undefined, fallback = 0): number => {
  if (v === undefined || v === null || v === '') return fallback;
  const n = Number(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : fallback;
};

const toBool = (v: string | undefined): boolean => {
  if (!v) return false;
  const s = String(v).toLowerCase().trim();
  return s === 'true' || s === '1' || s === 'yes';
};

const toDate = (v: string | undefined): string | null => {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
};

const toTimestamp = (v: string | undefined): string | null => {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
};

// ---------------------------------------------------------------------------
// Chunked insert with per-row fallback
// ---------------------------------------------------------------------------

const CHUNK = 400;

async function chunkedInsert(
  table: string,
  rows: Record<string, unknown>[],
): Promise<{ inserted: number; errors: string[] }> {
  const errors: string[] = [];
  let inserted = 0;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from(table).insert(slice);
    if (!error) {
      inserted += slice.length;
      continue;
    }
    // Batch failed — retry per-row to isolate the bad ones
    for (let j = 0; j < slice.length; j++) {
      const { error: rowErr } = await supabase.from(table).insert([slice[j]]);
      if (rowErr) {
        errors.push(`row ${i + j + 1}: ${rowErr.message}`);
      } else {
        inserted++;
      }
    }
  }
  return { inserted, errors };
}

// ---------------------------------------------------------------------------
// Transformers
// ---------------------------------------------------------------------------

export function mapCourses(rows: Record<string, string>[]) {
  return rows
    .filter((r) => r.course_id && r.name_kh)
    .map((r) => ({
      course_id:  r.course_id,
      name_kh:    r.name_kh,
      name_en:    emptyToNull(r.name_en),
      hourly_fee: toInt(r.hourly_fee, 0),
      status:     r.status === 'inactive' ? 'inactive' : 'active',
      created_at: toTimestamp(r.created_at) ?? new Date().toISOString(),
      updated_at: toTimestamp(r.updated_at) ?? new Date().toISOString(),
    }));
}

export function mapStudents(rows: Record<string, string>[]) {
  return rows
    .filter((r) => r.student_id && r.name_kh && r.course)
    .map((r) => {
      const row: Record<string, unknown> = {
        student_id:    r.student_id,
        name_kh:       r.name_kh,
        gender:        ['male','female','other'].includes(r.gender) ? r.gender : null,
        date_of_birth: toDate(r.date_of_birth),
        grade:         emptyToNull(r.grade),
        course:        r.course,
        status:        ['active','inactive','graduated','dropped'].includes(r.status)
                       ? r.status
                       : 'active',
        created_at:    toTimestamp(r.created_at) ?? new Date().toISOString(),
        updated_at:    toTimestamp(r.updated_at) ?? new Date().toISOString(),
        created_by:    null,
      };
      if (r.portal_token) {
        row.portal_token = r.portal_token.replace(/[+/=]/g, '_');
      }
      // If portal_token omitted, DEFAULT fires
      return row;
    });
}

// ---------------------------------------------------------------------------
// Payments — merged by (student_id, payment_date)
// ---------------------------------------------------------------------------

interface MergedPayments {
  payments: Record<string, unknown>[];
  /** old payment_id → surviving winner payment_id */
  aliasMap: Map<string, string>;
  mergedGroups: number;   // number of (student, date) groups that had >1 row
  mergedRows: number;     // total original rows that were collapsed
}

export function mapPaymentsMerged(rows: Record<string, string>[]): MergedPayments {
  const groups = new Map<string, Record<string, string>[]>();

  for (const r of rows) {
    if (!r.payment_id || !r.student_id || !r.recorded_by) continue;
    const date = toDate(r.payment_date);
    if (!date) continue;
    const key = `${r.student_id}|${date}`;
    const arr = groups.get(key);
    if (arr) arr.push(r);
    else groups.set(key, [r]);
  }

  const payments: Record<string, unknown>[] = [];
  const aliasMap = new Map<string, string>();
  let mergedGroups = 0;
  let mergedRows = 0;

  for (const [, group] of groups) {
    // Deterministic winner: smallest payment_id
    group.sort((a, b) => a.payment_id.localeCompare(b.payment_id));
    const winner = group[0];
    const winnerId = winner.payment_id;

    if (group.length > 1) {
      mergedGroups++;
      mergedRows += group.length;
    }

    let total = 0;
    let paid = 0;
    const notes: string[] = [];
    let earliestCreated: string | null = null;
    let latestUpdated: string | null = null;
    let latestPaidAt: string | null = null;

    for (const r of group) {
      aliasMap.set(r.payment_id, winnerId);
      total += toInt(r.total_amount, 0);
      paid  += toInt(r.paid_amount, 0);

      if (r.note && r.note.trim()) notes.push(r.note.trim());

      const cAt = toTimestamp(r.created_at);
      const uAt = toTimestamp(r.updated_at);
      const pAt = toTimestamp(r.paid_at);
      if (cAt && (!earliestCreated || cAt < earliestCreated)) earliestCreated = cAt;
      if (uAt && (!latestUpdated  || uAt > latestUpdated))  latestUpdated  = uAt;
      if (pAt && (!latestPaidAt   || pAt > latestPaidAt))   latestPaidAt   = pAt;
    }

    if (paid > total) paid = total;
    const isPaid = total > 0 && paid >= total;

    payments.push({
      payment_id:   winnerId,
      student_id:   winner.student_id,
      payment_date: toDate(winner.payment_date)!,
      is_paid:      isPaid,
      paid_amount:  paid,
      total_amount: total,
      recorded_by:  winner.recorded_by,
      note:         notes.length
                      ? notes.join(' | ').slice(0, 500)
                      : null,
      created_at:   earliestCreated ?? new Date().toISOString(),
      updated_at:   latestUpdated  ?? new Date().toISOString(),
      paid_at:      isPaid
                      ? (latestPaidAt ?? latestUpdated ?? new Date().toISOString())
                      : null,
    });
  }

  return { payments, aliasMap, mergedGroups, mergedRows };
}

// ---------------------------------------------------------------------------
// Payment items — reassigned via aliasMap + merged by (payment_id, course_id)
// ---------------------------------------------------------------------------

export function mapPaymentItemsMerged(
  rows: Record<string, string>[],
  aliasMap: Map<string, string>,
): Record<string, unknown>[] {
  // 1. Rewrite payment_id to its winner
  const rewritten: Record<string, string>[] = [];
  for (const r of rows) {
    if (!r.item_id || !r.payment_id || !r.course_id) continue;
    const winnerId = aliasMap.get(r.payment_id) ?? r.payment_id;
    rewritten.push({ ...r, payment_id: winnerId });
  }

  // 2. Group by (payment_id, course_id)
  const groups = new Map<string, Record<string, string>[]>();
  for (const r of rewritten) {
    const key = `${r.payment_id}|${r.course_id}`;
    const arr = groups.get(key);
    if (arr) arr.push(r);
    else groups.set(key, [r]);
  }

  // 3. Emit one row per group
  const result: Record<string, unknown>[] = [];
  const usedIds = new Set<string>();

  for (const [, group] of groups) {
    group.sort((a, b) => a.item_id.localeCompare(b.item_id));
    const winner = group[0];

    let itemId = winner.item_id;
    if (usedIds.has(itemId)) {
      // Extremely rare: two different payments had the same item_id.
      // Generate a fresh unique suffix.
      let n = 1;
      while (usedIds.has(`${winner.item_id}_${n}`)) n++;
      itemId = `${winner.item_id}_${n}`;
    }
    usedIds.add(itemId);

    let hours = 0;
    let subtotal = 0;
    for (const r of group) {
      hours    += toInt(r.hours, 1);
      subtotal += toInt(r.subtotal, 0);
    }

    result.push({
      item_id:             itemId,
      payment_id:          winner.payment_id,
      course_id:           winner.course_id,
      course_name_at_time: winner.course_name_at_time || winner.course_id,
      hours:               Math.max(1, hours),
      hourly_fee_at_time:  toInt(winner.hourly_fee_at_time, 0),
      subtotal:            subtotal,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Import users via Edge Function
// ---------------------------------------------------------------------------

export async function importUsers(
  users: Array<{
    user_id?: string;
    username: string;
    full_name: string;
    email?: string | null;
    role: 'owner' | 'staff';
    is_active?: boolean;
  }>,
  defaultPassword: string,
): Promise<{ created: number; skipped: number; errors: Array<{ username: string; reason: string }> }> {
  const { data, error } = await supabase.functions.invoke('import-users', {
    body: { users, default_password: defaultPassword },
  });
  if (error) throw new Error(error.message);
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(String((data as { error: unknown }).error));
  }
  return data as {
    created: number;
    skipped: number;
    errors: Array<{ username: string; reason: string }>;
  };
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export interface ImportInputs {
  courses?: Record<string, string>[];
  users?: Record<string, string>[];
  students?: Record<string, string>[];
  payments?: Record<string, string>[];
  paymentItems?: Record<string, string>[];
}

export interface ImportProgress {
  step: string;
  done: number;
  total: number;
  detail?: string;
}

export interface ImportReport {
  courses:      { inserted: number; errors: string[] };
  users:        { created: number; skipped: number; errors: Array<{ username: string; reason: string }> };
  students:     { inserted: number; errors: string[] };
  payments:     { inserted: number; errors: string[]; mergedGroups: number; mergedRows: number };
  paymentItems: { inserted: number; errors: string[] };
  sequencesFixed: boolean;
}

export async function runImport(
  inputs: ImportInputs,
  options: { defaultPassword: string; wipeFirst: boolean },
  onProgress: (p: ImportProgress) => void,
): Promise<ImportReport> {
  const report: ImportReport = {
    courses:      { inserted: 0, errors: [] },
    users:        { created: 0, skipped: 0, errors: [] },
    students:     { inserted: 0, errors: [] },
    payments:     { inserted: 0, errors: [], mergedGroups: 0, mergedRows: 0 },
    paymentItems: { inserted: 0, errors: [] },
    sequencesFixed: false,
  };

  // 1. Wipe
  if (options.wipeFirst) {
    onProgress({ step: 'wipe', done: 0, total: 1 });
    const { error } = await supabase.rpc('wipe_data_tables' as never);
    if (error) throw new Error(`wipe: ${error.message}`);
    onProgress({ step: 'wipe', done: 1, total: 1 });
  }

  // 2. Courses
  const courseRows = inputs.courses ? mapCourses(inputs.courses) : [];
  if (courseRows.length) {
    onProgress({ step: 'courses', done: 0, total: courseRows.length });
    const r = await chunkedInsert('courses', courseRows);
    report.courses = r;
    onProgress({ step: 'courses', done: r.inserted, total: courseRows.length });
  }

  // 3. Users
  const userRows = (inputs.users ?? [])
    .filter((r) => r.username && r.role)
    .map((r) => ({
      user_id:   emptyToNull(r.user_id) ?? undefined,
      username:  r.username.trim().toLowerCase(),
      full_name: r.full_name || r.username,
      email:     emptyToNull(r.email),
      role:      (r.role === 'owner' ? 'owner' : 'staff') as 'owner' | 'staff',
      is_active: r.is_active === undefined ? true : toBool(r.is_active),
    }));
  if (userRows.length) {
    onProgress({ step: 'users', done: 0, total: userRows.length });
    const r = await importUsers(userRows, options.defaultPassword);
    report.users = r;
    onProgress({ step: 'users', done: r.created + r.skipped, total: userRows.length });
  }

  // 4. Students
  const studentRows = inputs.students ? mapStudents(inputs.students) : [];
  if (studentRows.length) {
    onProgress({ step: 'students', done: 0, total: studentRows.length });
    const r = await chunkedInsert('students', studentRows);
    report.students = r;
    onProgress({ step: 'students', done: r.inserted, total: studentRows.length });
  }

  // 5. Payments (with same-day merge)
  const merged = inputs.payments
    ? mapPaymentsMerged(inputs.payments)
    : { payments: [], aliasMap: new Map<string, string>(), mergedGroups: 0, mergedRows: 0 };

  if (merged.payments.length) {
    onProgress({
      step: 'payments',
      done: 0,
      total: merged.payments.length,
      detail: merged.mergedGroups > 0
        ? `merging ${merged.mergedRows} rows into ${merged.mergedGroups} groups`
        : undefined,
    });
    const r = await chunkedInsert('payments', merged.payments);
    report.payments = { ...r, mergedGroups: merged.mergedGroups, mergedRows: merged.mergedRows };
    onProgress({ step: 'payments', done: r.inserted, total: merged.payments.length });
  }

  // 6. Payment items (using alias map)
  const itemRows = inputs.paymentItems
    ? mapPaymentItemsMerged(inputs.paymentItems, merged.aliasMap)
    : [];
  if (itemRows.length) {
    onProgress({ step: 'items', done: 0, total: itemRows.length });
    const r = await chunkedInsert('payment_items', itemRows);
    report.paymentItems = r;
    onProgress({ step: 'items', done: r.inserted, total: itemRows.length });
  }

  // 7. Fix sequences
  onProgress({ step: 'sequences', done: 0, total: 1 });
  const { error: seqErr } = await supabase.rpc('fix_id_sequences' as never);
  report.sequencesFixed = !seqErr;
  onProgress({ step: 'sequences', done: 1, total: 1 });

  return report;
}