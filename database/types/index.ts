// database/types/index.ts
// Single source of truth untuk tipe database Fluxa.
// Re-export dari frontend/lib/supabase/types.ts agar seluruh layer
// (backend, intelligence, dan database) menggunakan definisi yang sama.
export * from '../../frontend/lib/supabase/types';
export type { Database, Json } from '../../frontend/lib/supabase/types';
