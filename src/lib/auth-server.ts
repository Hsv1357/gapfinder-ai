import { createClient } from './supabase/server';
import { User } from '@supabase/supabase-js';

export async function getAuthenticatedUser(): Promise<{ user: User | null; supabase: any }> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, supabase };
  }

  return { user, supabase };
}
