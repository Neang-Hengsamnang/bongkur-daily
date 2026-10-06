import { supabase } from '../supabase';

export type Gender = 'male' | 'female' | 'other';
export type StudentStatus = 'active' | 'inactive' | 'graduated' | 'dropped';

export interface Student {
  student_id: string;
  name_kh: string;
  gender: Gender | null;
  date_of_birth: string | null;
  grade: string | null;
  course: string;
  status: StudentStatus;
  portal_token: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface StudentInput {
  name_kh: string;
  gender: Gender | null;
  date_of_birth: string | null;
  grade: string | null;
  course: string;
  status?: StudentStatus;
}

export async function listStudents(
  opts: { search?: string; course?: string; status?: StudentStatus | 'all' } = {},
): Promise<Student[]> {
  const PAGE = 1000;
  let offset = 0;
  const out: Student[] = [];

  while (true) {
    let q = supabase
      .from('students')
      .select('*')
      .order('name_kh', { ascending: true })
      .range(offset, offset + PAGE - 1);

    if (opts.status && opts.status !== 'all') q = q.eq('status', opts.status);
    if (opts.course) q = q.eq('course', opts.course);

    const s = opts.search?.trim();
    if (s) {
      q = q.or(`name_kh.ilike.%${s}%,student_id.ilike.%${s}%,grade.ilike.%${s}%`);
    }

    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;

    out.push(...(data as Student[]));
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return out;
}

export async function createStudent(
  input: StudentInput,
  createdBy: string,
): Promise<Student> {
  const { data, error } = await supabase
    .from('students')
    .insert({
      name_kh: input.name_kh.trim(),
      gender: input.gender,
      date_of_birth: input.date_of_birth,
      grade: input.grade?.trim() || null,
      course: input.course,
      created_by: createdBy,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Student;
}

export async function updateStudent(
  id: string,
  patch: Partial<StudentInput>,
): Promise<Student> {
  const clean: Record<string, unknown> = {};
  if (patch.name_kh !== undefined) clean.name_kh = patch.name_kh.trim();
  if (patch.gender !== undefined) clean.gender = patch.gender;
  if (patch.date_of_birth !== undefined) clean.date_of_birth = patch.date_of_birth;
  if (patch.grade !== undefined) clean.grade = patch.grade?.trim() || null;
  if (patch.course !== undefined) clean.course = patch.course;
  if (patch.status !== undefined) clean.status = patch.status;

  const { data, error } = await supabase
    .from('students')
    .update(clean)
    .eq('student_id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Student;
}

export async function setStudentStatus(id: string, status: StudentStatus): Promise<void> {
  const { error } = await supabase
    .from('students')
    .update({ status })
    .eq('student_id', id);
  if (error) throw error;
}