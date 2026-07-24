import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const isPlaceholderUrl = (value: string | undefined) =>
  !value ||
  /YOUR_|PROJECT_REF|example\.com/i.test(value) ||
  !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(value);

const isPlaceholderKey = (value: string | undefined) =>
  !value ||
  /YOUR_|ANON_KEY_HERE|PLACEHOLDER/i.test(value) ||
  value.length < 20;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !isPlaceholderUrl(supabaseUrl) &&
    !isPlaceholderKey(supabaseAnonKey),
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;
