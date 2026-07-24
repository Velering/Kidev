import { afterEach, describe, expect, it, vi } from 'vitest';

describe('supabaseClient placeholder detection', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('treats .env.example placeholders as unconfigured', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://YOUR_PROJECT_REF.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'YOUR_SUPABASE_ANON_KEY_HERE');
    const mod = await import('./supabaseClient');
    expect(mod.isSupabaseConfigured).toBe(false);
    expect(mod.supabase).toBeNull();
  });

  it('accepts a real-looking supabase URL + anon key', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abcdefghijklmnop.supabase.co');
    vi.stubEnv(
      'VITE_SUPABASE_ANON_KEY',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.signature',
    );
    const mod = await import('./supabaseClient');
    expect(mod.isSupabaseConfigured).toBe(true);
    expect(mod.supabase).not.toBeNull();
  });
});
