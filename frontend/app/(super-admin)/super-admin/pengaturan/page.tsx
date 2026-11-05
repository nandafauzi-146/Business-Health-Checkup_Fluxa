import SuperAdminSettings from '@/features/super-admin/SuperAdminSettings'

export const metadata = {
  title: 'Pengaturan Sistem - Super Admin | FLUXA',
  description: 'Konfigurasi parameter operasional platform, kebijakan durasi trial awal, dan integrasi backend FLUXA.',
}

export default function SuperAdminSettingsPage() {
  return <SuperAdminSettings />
}
