import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://ewsahqwtupghisvbekvf.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface DashboardUser {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  role: 'admin' | 'user';
  created_at: string;
  updated_at: string;
}

export async function getUserByEmail(email: string): Promise<DashboardUser | null> {
  const { data, error } = await supabase
    .from('dashboard_users')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();
  
  if (error || !data) return null;
  return data as DashboardUser;
}

export async function createUser(email: string, passwordHash: string, name: string, role: 'admin' | 'user' = 'user'): Promise<DashboardUser | null> {
  const { data, error } = await supabase
    .from('dashboard_users')
    .insert({
      email: email.toLowerCase(),
      password_hash: passwordHash,
      name,
      role,
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating user:', error);
    return null;
  }
  return data as DashboardUser;
}

export async function getAllUsers(): Promise<DashboardUser[]> {
  const { data, error } = await supabase
    .from('dashboard_users')
    .select('id, email, name, role, created_at')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching users:', error);
    return [];
  }
  return data as DashboardUser[];
}

export async function deleteUser(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('dashboard_users')
    .delete()
    .eq('id', id);
  
  return !error;
}

export async function updateUserPassword(id: string, passwordHash: string): Promise<boolean> {
  const { error } = await supabase
    .from('dashboard_users')
    .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
    .eq('id', id);
  
  return !error;
}
