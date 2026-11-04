import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, ShieldCheck, Printer } from 'lucide-react'
import TermsAndConditionsContent from '@/components/legal/TermsAndConditionsContent'

export const metadata: Metadata = {
  title: 'Syarat dan Ketentuan Layanan | Fluxa',
  description: 'Syarat dan Ketentuan Penggunaan Platform Kasir Pintar (POS) dan Business Health Advisor Fluxa.',
}

export default function TermsPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#1e293b', fontFamily: 'inherit' }}>
      {/* Top Navbar */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <div
          style={{
            maxWidth: '1000px',
            margin: '0 auto',
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              textDecoration: 'none',
              color: 'inherit',
              fontWeight: 800,
              fontSize: '20px',
              letterSpacing: '-0.8px',
            }}
          >
            <Image src="/Fluxa-Logo.webp" alt="Fluxa Logo" width={32} height={32} />
            <span>fluxa<span style={{ color: '#2563eb' }}>.</span></span>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <Link
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#475569',
                textDecoration: 'none',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
              }}
            >
              <ArrowLeft size={15} /> Kembali ke Beranda
            </Link>

            <Link
              href="/register"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#ffffff',
                textDecoration: 'none',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
              }}
            >
              Daftar Sekarang
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Card */}
      <main style={{ maxWidth: '840px', margin: '40px auto', padding: '0 20px 80px' }}>
        <div
          style={{
            background: '#ffffff',
            borderRadius: '24px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 10px 30px -5px rgba(15, 23, 42, 0.06)',
            padding: '40px clamp(20px, 5vw, 48px)',
          }}
        >
          {/* Header Banner inside document */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '24px',
              paddingBottom: '24px',
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: '#eff6ff',
                color: '#2563eb',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <ShieldCheck size={26} />
            </div>
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 'clamp(22px, 3.5vw, 28px)',
                  fontWeight: 800,
                  letterSpacing: '-0.8px',
                  color: '#0f172a',
                }}
              >
                Syarat dan Ketentuan Layanan
              </h1>
              <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#64748b' }}>
                Platform Kasir Pintar (POS) &amp; Business Health Intelligence Fluxa
              </p>
            </div>
          </div>

          {/* Legal Text */}
          <TermsAndConditionsContent />

          {/* Action Box at bottom */}
          <div
            style={{
              marginTop: '40px',
              padding: '24px',
              background: '#f8fafc',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
            }}
          >
            <div>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                Siap memulai transformasi usaha Anda?
              </h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                Nikmati kemudahan kasir praktis dan laporan keuangan otomatis dengan Free Trial 7 Hari.
              </p>
            </div>

            <Link
              href="/register"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#ffffff',
                textDecoration: 'none',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              }}
            >
              Mulai Coba Gratis 7 Hari
            </Link>
          </div>
        </div>
      </main>

      {/* Simple Footer */}
      <footer style={{ borderTop: '1px solid #e2e8f0', background: '#ffffff', padding: '24px 20px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
        © {new Date().getFullYear()} Fluxa. Hak Cipta Dilindungi Undang-Undang.
      </footer>
    </div>
  )
}
