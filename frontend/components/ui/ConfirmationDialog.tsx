'use client'

import React, { useEffect, useRef, useState } from 'react'
import { X, AlertTriangle, LogOut, Trash2, Info } from 'lucide-react'

export interface ConfirmationDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  message: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'primary'
  icon?: 'logout' | 'delete' | 'warning' | 'info'
  isLoading?: boolean
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Konfirmasi',
  cancelLabel = 'Batal',
  variant = 'primary',
  icon,
  isLoading = false
}) => {
  const confirmBtnRef = useRef<HTMLButtonElement>(null)
  const [internalLoading, setInternalLoading] = useState(false)
  const busy = isLoading || internalLoading

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        onClose()
      }
    }

    // Cegah scroll halaman saat dialog konfirmasi aktif
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    window.addEventListener('keydown', handleKeyDown)
    
    // Auto-focus tombol konfirmasi untuk aksesibilitas keyboard
    const timer = setTimeout(() => {
      confirmBtnRef.current?.focus()
    }, 50)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
      clearTimeout(timer)
    }
  }, [isOpen, busy, onClose])

  if (!isOpen) return null

  const handleConfirm = async () => {
    if (busy) return
    try {
      setInternalLoading(true)
      await onConfirm()
    } finally {
      setInternalLoading(false)
    }
  }

  const renderIcon = () => {
    const iconType = icon || (variant === 'danger' ? 'delete' : variant === 'warning' ? 'warning' : 'info')
    switch (iconType) {
      case 'logout':
        return <LogOut size={22} />
      case 'delete':
        return <Trash2 size={22} />
      case 'warning':
        return <AlertTriangle size={22} />
      case 'info':
        return <Info size={22} />
      default:
        return null
    }
  }

  const getButtonVariantClass = () => {
    switch (variant) {
      case 'danger':
        return 'confirmation-btn-danger'
      case 'warning':
        return 'confirmation-btn-warning'
      default:
        return 'confirmation-btn-primary'
    }
  }

  return (
    <div
      className="confirmation-dialog-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) {
          onClose()
        }
      }}
      role="presentation"
    >
      <div
        className="confirmation-dialog-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirmation-dialog-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            {(icon || variant) && (
              <div className={`confirmation-dialog-icon ${variant}`}>
                {renderIcon()}
              </div>
            )}
            <h3 id="confirm-dialog-title" className="confirmation-dialog-title">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="confirmation-dialog-close"
            aria-label="Tutup dialog"
            disabled={busy}
          >
            <X size={18} />
          </button>
        </div>

        <div id="confirm-dialog-desc" className="confirmation-dialog-message">
          {message}
        </div>

        <div className="confirmation-dialog-actions">
          <button
            type="button"
            className="confirmation-btn confirmation-btn-cancel"
            onClick={onClose}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            className={`confirmation-btn ${getButtonVariantClass()}`}
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy && <div className="confirmation-spinner" />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmationDialog
