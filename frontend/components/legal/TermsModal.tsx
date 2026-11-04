'use client'

import React, { useEffect } from 'react'
import { X, ShieldCheck, Check } from 'lucide-react'
import TermsAndConditionsContent from './TermsAndConditionsContent'

interface TermsModalProps {
  isOpen: boolean
  onClose: () => void
  onAgree?: () => void
}

export default function TermsModal({ isOpen, onClose, onAgree }: TermsModalProps) {
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'grid',
        placeItems: 'center',
        padding: '16px',
        background: 'rgba(8, 15, 34, 0.72)',
        backdropFilter: 'blur(8px)',
        animation: 'termsFadeIn 0.2s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          width: 'min(100%, 720px)',
          maxHeight: 'min(85vh, 760px)',
          background: '#ffffff',
          color: '#1e293b',
          borderRadius: '20px',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.45)',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'termsZoomIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: '#eff6ff',
                color: '#2563eb',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2
                id="terms-modal-title"
                style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a' }}
              >
                Syarat &amp; Ketentuan Layanan
              </h2>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Pedoman Penggunaan Platform Fluxa
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup syarat dan ketentuan"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s ease',
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = '#e2e8f0')}
            onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <X size={20} />
          </button>
        </header>

        {/* Scrollable Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            fontSize: '14px',
          }}
        >
          <TermsAndConditionsContent />
        </div>

        {/* Footer */}
        <footer
          style={{
            padding: '14px 24px',
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '9px 18px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#475569',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              cursor: 'pointer',
            }}
          >
            Tutup
          </button>

          {onAgree && (
            <button
              type="button"
              onClick={() => {
                onAgree()
                onClose()
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 20px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#ffffff',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                boxShadow: '0 4px 10px rgba(37, 99, 235, 0.3)',
              }}
            >
              <Check size={16} /> Saya Mengerti &amp; Setuju
            </button>
          )}
        </footer>
      </div>

      <style jsx global>{`
        @keyframes termsFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes termsZoomIn {
          from { opacity: 0; transform: scale(0.96) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}
