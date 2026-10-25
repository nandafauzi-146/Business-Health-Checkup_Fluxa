/**
 * backend/supabase/admin.ts
 * Supabase Service Role Admin Client terpusat.
 * Hanya boleh diimpor dan dijalankan di lingkungan server (API route handlers / Server Components / Services).
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

export function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Konfigurasi Supabase server belum lengkap (SUPABASE_SERVICE_ROLE_KEY).');
  }

  return createClient<any>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function tryGetSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return null;
  }

  return createClient<any>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

