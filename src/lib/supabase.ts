import { createBrowserClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock-key';

// Standard Supabase JS client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Browser client for Client Components (no server-only imports)
export const createClientComponent = () => {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
};
