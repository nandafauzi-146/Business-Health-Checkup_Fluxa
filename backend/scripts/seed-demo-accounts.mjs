// scripts/seed-demo-accounts.mjs
// Script pembuatan 3 akun demo (Owner, Admin, Kasir) menggunakan Admin API Supabase

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Baca .env.local jika ada
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [key, ...values] = trimmed.split('=');
      const val = values.join('=').trim();
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = val;
      }
    }
  }
}

loadEnv();

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY harus terisi di .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const DEMO_ACCOUNTS = [
  {
    email: 'owner@demo.local',
    password: 'Owner123!',
    role: 'owner',
    full_name: 'Owner Toko Fluxa',
    phone: '081200000001'
  },
  {
    email: 'admin@demo.local',
    password: 'Admin123!',
    role: 'admin',
    full_name: 'Admin Operasional',
    phone: '081200000002'
  },
  {
    email: 'kasir@demo.local',
    password: 'Kasir123!',
    role: 'kasir',
    full_name: 'Kasir Utama',
    phone: '081200000003'
  }
];

async function seed() {
  console.log('--- Memulai Seed Akun Demo ---');

  for (const acc of DEMO_ACCOUNTS) {
    // 1. Cek apakah user sudah terdaftar di auth.users
    const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.error('Gagal mengambil daftar user:', listError.message);
      return;
    }

    const existingUser = usersData.users.find(u => u.email === acc.email);

    if (existingUser) {
      console.log(`[EXISTING] ${acc.email} (${acc.role}) sudah ada. Memperbarui password & metadata...`);
      const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
        password: acc.password,
        user_metadata: {
          role: acc.role,
          full_name: acc.full_name,
          phone: acc.phone
        }
      });
      if (updateError) {
        console.error(`Gagal update user ${acc.email}:`, updateError.message);
      } else {
        // Sinkronkan ke public.profiles
        await supabase.from('profiles').upsert({
          id: existingUser.id,
          role: acc.role,
          full_name: acc.full_name,
          phone: acc.phone
        });
        console.log(`  -> Berhasil diperbarui.`);
      }
    } else {
      console.log(`[CREATING] Membuat akun baru: ${acc.email} (${acc.role})...`);
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: acc.email,
        password: acc.password,
        email_confirm: true,
        user_metadata: {
          role: acc.role,
          full_name: acc.full_name,
          phone: acc.phone
        }
      });

      if (createError) {
        console.error(`Gagal membuat user ${acc.email}:`, createError.message);
      } else {
        console.log(`  -> Berhasil dibuat dengan ID: ${newUser.user.id}`);
        // Ensure profile is created
        await supabase.from('profiles').upsert({
          id: newUser.user.id,
          role: acc.role,
          full_name: acc.full_name,
          phone: acc.phone
        });
      }
    }
  }

  console.log('--- Selesai Menyiapkan Akun Demo ---');
}

seed().catch(err => {
  console.error('Terjadi error:', err);
  process.exit(1);
});
