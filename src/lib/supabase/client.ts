import { createBrowserClient } from '@supabase/ssr';

export function getCleanSupabaseUrl(url?: string): string {
  const raw = url || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  return raw.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
}

export function createClient() {
  const supabaseUrl = getCleanSupabaseUrl();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase URL or Key is missing. Check your environment variables.');
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
