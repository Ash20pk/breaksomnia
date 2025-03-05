'use server';

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with server-side credentials
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Check if Supabase connection is working
 */
export async function checkSupabaseConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    // Try a simple query to check if the connection works
    const { data, error } = await supabase
      .from('transaction_queue')
      .select('count(*)', { count: 'exact', head: true });

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Server Action Error - checkSupabaseConnection:', error);
    return { success: false, error: error.message };
  }
}