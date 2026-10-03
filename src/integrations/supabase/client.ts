// ملف Supabase Client المعدل لضمان النشر الناجح
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { brokeredPreviewStorage } from './previewAuthStorage';

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }
    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

// قيم عامة (publishable) احتياطية في حال غياب متغيرات البيئة أثناء النشر
const FALLBACK_SUPABASE_URL = 'https://spjpgivhstizdovkiapv.supabase.co';
const FALLBACK_SUPABASE_PUBLISHABLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwanBnaXZoc3RpemRvdmtpYXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2ODc2MDAsImV4cCI6MjEwMDI2MzYwMH0.u10MFX9rzetEZBguUky0HpsOVbsB7mMQlOi3QiXLWGU';

function createSupabaseClient() {
  const viteEnv: Record<string, string | undefined> = (import.meta as any).env ?? {};
  const nodeEnv: Record<string, string | undefined> =
    typeof process !== 'undefined' && process.env ? (process.env as any) : {};

  const SUPABASE_URL =
    import.meta.env.VITE_SUPABASE_URL || viteEnv.VITE_SUPABASE_URL || nodeEnv.SUPABASE_URL || nodeEnv.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || viteEnv.VITE_SUPABASE_PUBLISHABLE_KEY || nodeEnv.SUPABASE_PUBLISHABLE_KEY || nodeEnv.VITE_SUPABASE_PUBLISHABLE_KEY || FALLBACK_SUPABASE_PUBLISHABLE_KEY;

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
    },
    auth: {
      storage: brokeredPreviewStorage(),
      persistSession: true,
      autoRefreshToken: true,
    }
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});