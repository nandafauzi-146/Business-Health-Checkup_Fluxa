// backend/supabase/types.ts
// Re-export dari frontend/lib/supabase/types.ts untuk menjaga satu sumber kebenaran (single source of truth)
export * from '../../frontend/lib/supabase/types';
export type { Database, Json } from '../../frontend/lib/supabase/types';
