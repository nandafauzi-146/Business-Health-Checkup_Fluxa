/**
 * backend/index.ts
 * Entry point utama untuk modul Backend Services & Adapters Fluxa.
 */

// Supabase admin client (service role)
export * from './supabase/admin';

// Financial context service
export * from './services/financial-context.service';

// Database types (canonical source: database/types/index.ts)
export type { Database, Json } from './supabase/types';

