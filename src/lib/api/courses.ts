import { supabase } from '../supabase';

export type CourseStatus = 'active' | 'inactive';

export interface Course {
  course_id: string;
  name_kh: string;
  name_en: string | null;
  hourly_fee: number;
  status: CourseStatus;
  created_at: string;
  updated_at: string;
}

export interface CourseInput {
  name_kh: string;
  name_en?: string | null;
  hourly_fee: number;
}

export async function listCourses(
  opts: { search?: string; status?: CourseStatus | 'all' } = {},
): Promise<Course[]> {
  let q = supabase.from('courses').select('*').order('created_at', { ascending: false });
  if (opts.status && opts.status !== 'all') q = q.eq('status', opts.status);
  const s = opts.search?.trim();
  if (s) q = q.or(`name_kh.ilike.%${s}%,name_en.ilike.%${s}%,course_id.ilike.%${s}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Course[];
}

export async function createCourse(input: CourseInput): Promise<Course> {
  const { data, error } = await supabase
    .from('courses')
    .insert({
      name_kh: input.name_kh.trim(),
      name_en: input.name_en?.trim() || null,
      hourly_fee: Math.max(0, Math.round(input.hourly_fee)),
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Course;
}

export async function updateCourse(
  id: string, patch: Partial<CourseInput>,
): Promise<Course> {
  const clean: Record<string, unknown> = {};
  if (patch.name_kh !== undefined) clean.name_kh = patch.name_kh.trim();
  if (patch.name_en !== undefined) clean.name_en = patch.name_en?.trim() || null;
  if (patch.hourly_fee !== undefined) clean.hourly_fee = Math.max(0, Math.round(patch.hourly_fee));

  const { data, error } = await supabase
    .from('courses')
    .update(clean)
    .eq('course_id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Course;
}

export async function setCourseStatus(id: string, status: CourseStatus): Promise<void> {
  const { error } = await supabase
    .from('courses')
    .update({ status })
    .eq('course_id', id);
  if (error) throw error;
}