import { createClient } from '@supabase/supabase-js';

// The .env file is causing issues in the user's environment.
// For the final build, we will hardcode these public credentials.
// This is safe because the 'anon' key is designed to be public.
const supabaseUrl = "https://sbkefmonnammghplxkul.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNia2VmbW9ubmFtbWdocGx4a3VsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxNjcxNzAsImV4cCI6MjA3Nzc0MzE3MH0.yp1puAK9GkeenbRyL0lW61uqCTc_voZc7Y3YLJ4g";

// Create and export the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
