'use client'

import { useState, useRef, useEffect, type FormEvent } from 'react'
import {
  Bot,
  X,
  Send,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  MessageSquare,
  ArrowUpRight,
} from 'lucide-react'
import styles from './customer-service.module.css'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

const INITIAL_MESSAGE: Message = {
  id: 'init-1',
  role: 'assistant',
  content:
    'Selamat datang di Fluxa. Saya adalah Fluxa AI Assistant, asisten informasi resmi untuk layanan Fluxa.\n\nSaya bertugas membantu Anda memahami fitur Kasir POS, Kontrol Stok, Kasbon Pelanggan, atau cara memulai Coba Gratis 7 Hari.\n\nInformasi apa yang dapat saya bantu jelaskan?',
  timestamp: 'Baru saja',
}

const SUGGESTIONS = [
  'Apa saja fitur utama Fluxa?',
  'Bagaimana cara mencoba Coba Gratis 7 Hari?',
  'Bagaimana alur pendaftaran akun Fluxa?',
]

function formatCurrentTime(): string {
  const now = new Date()
  return now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Safe Text & Simple Markdown Renderer
 * Memenuhi Section 15: Output Safety (Raw HTML dinonaktifkan sepenuhnya untuk mencegah XSS).
 */
function renderSafeFormattedText(text: string) {
  const lines = text.split('\n')
  return (
    <div>
      {lines.map((line, idx) => {
        const trimmed = line.trim()
        if (!trimmed) {
          return <div key={idx} style={{ height: '6px' }} />
        }

        const isBullet = trimmed.startsWith('* ') || trimmed.startsWith('- ')
        const content = isBullet ? trimmed.substring(2) : line

        // Parse **bold** secara aman tanpa dangerouslySetInnerHTML
        const parts = content.split(/(\*\*[^*]+\*\*)/g)
        const renderedParts = parts.map((part, pIdx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={pIdx}>{part.slice(2, -2)}</strong>
          }
          return part
        })

        if (isBullet) {
          return (
            <div key={idx} style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
              <span style={{ color: '#2563eb', fontWeight: 'bold' }}>•</span>
              <div>{renderedParts}</div>
            </div>
          )
        }

        return (
          <p key={idx} style={{ margin: '0 0 4px 0' }}>
            {renderedParts}
          </p>
        )
      })}
    </div>
  )
}

export default function CustomerServiceWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [hasUnread, setHasUnread] = useState(true)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setHasUnread(false)
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [isOpen, messages])

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || input).trim()
    if (!text || isLoading) return

    // Batasi input sisi klien maksimal 1000 karakter
    if (text.length > 1000) {
      alert('Pesan melebihi batas maksimal 1000 karakter.')
      return
    }

    // Batasi jumlah giliran per sesi (maksimal 25 pesan total dalam 1 sesi)
    if (messages.length >= 25) {
      const limitMessage: Message = {
        id: `lim-${Date.now()}`,
        role: 'assistant',
        content:
          'Batas percakapan pada sesi ini telah tercapai. Silakan atur ulang sesi dengan tombol bersihkan percakapan di kanan atas, atau hubungi tim resmi Fluxa melalui WhatsApp di +62 898-0148-297.',
        timestamp: formatCurrentTime(),
      }
      setMessages((prev) => [...prev, limitMessage])
      return
    }

    const userMessage: Message = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: formatCurrentTime(),
    }

    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    if (!textToSend) setInput('')
    setIsLoading(true)

    try {
      // Ambil maksimal 8 riwayat percakapan terakhir
      const apiPayload = updatedMessages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-8)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }))

      const res = await fetch('/api/support-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiPayload }),
      })

      if (res.status === 429) {
        const errData = await res.json().catch(() => ({}))
        const assistantMessage: Message = {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          content:
            errData.error ||
            'Terlalu banyak pesan dalam waktu singkat. Silakan tunggu 1 menit sebelum mengirim pesan lagi.',
          timestamp: formatCurrentTime(),
        }
        setMessages((prev) => [...prev, assistantMessage])
        return
      }

      if (!res.ok) {
        throw new Error('Gagal memproses pesan')
      }

      const data = await res.json()
      const assistantMessage: Message = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content:
          data.reply ||
          'Terima kasih atas pertanyaannya. Jika butuh panduan lebih lanjut, Anda dapat menghubungi kanal resmi WhatsApp Fluxa di +62 898-0148-297.',
        timestamp: formatCurrentTime(),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch {
      const errorMessage: Message = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content:
          'Layanan asisten informasi sedang tidak dapat dihubungi sementara. Silakan tanyakan langsung ke tim resmi Fluxa via WhatsApp di **+62 898-0148-297**.',
        timestamp: formatCurrentTime(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    handleSendMessage()
  }

  const handleResetChat = () => {
    setMessages([
      {
        ...INITIAL_MESSAGE,
        timestamp: formatCurrentTime(),
      },
    ])
  }

  return (
    <div className={styles.floatingContainer}>
      {/* Tombol Melayang Launcher */}
      {!isOpen && (
        <button
          type="button"
          className={styles.launcherButton}
          onClick={() => setIsOpen(true)}
          aria-label="Buka Chat Fluxa AI Assistant"
        >
          <div className={styles.launcherIconWrap}>
            <Bot size={20} />
            {hasUnread && <span className={styles.onlineBadge} />}
          </div>
          <span className={styles.launcherText}>Tanya Fluxa AI</span>
        </button>
      )}

      {/* Kartu Jendela Chat */}
      {isOpen && (
        <div className={styles.chatWindow}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <div className={styles.avatar}>
                <Bot size={22} />
              </div>
              <div className={styles.headerInfo}>
                <h4>Fluxa AI Assistant</h4>
                <div className={styles.statusRow}>
                  <span className={styles.statusDot} />
                  <span className={styles.statusText}>Informasi Publik • Online</span>
                </div>
              </div>
            </div>

            <div className={styles.headerActions}>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={handleResetChat}
                title="Mulai Ulang Percakapan"
                aria-label="Mulai ulang percakapan"
              >
                <RotateCcw size={15} />
              </button>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => setIsOpen(false)}
                title="Tutup Chat"
                aria-label="Tutup jendela chat"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {/* Banner Pemberitahuan Kebijakan / Keamanan (Policy Notice) */}
          <div className={styles.noticeBanner}>
            <ShieldAlert size={14} style={{ color: '#2563eb', flexShrink: 0 }} />
            <span>
              <strong>Asisten Informasi Resmi:</strong> Menjawab seputar fitur & dokumentasi resmi.
            </span>
          </div>

          {/* Daftar Pesan */}
          <div className={styles.messagesList}>
            {messages.map((msg) => {
              const isUser = msg.role === 'user'
              return (
                <div
                  key={msg.id}
                  className={`${styles.messageRow} ${
                    isUser ? styles.messageRowUser : styles.messageRowAssistant
                  }`}
                >
                  {!isUser && (
                    <div className={styles.msgAvatar}>
                      <Sparkles size={14} />
                    </div>
                  )}
                  <div
                    className={`${styles.bubble} ${
                      isUser ? styles.bubbleUser : styles.bubbleAssistant
                    }`}
                  >
                    {isUser ? msg.content : renderSafeFormattedText(msg.content)}
                    <span className={styles.msgTime}>{msg.timestamp}</span>
                  </div>
                </div>
              )
            })}

            {/* Rekomendasi Pertanyaan Cepat (Chips) jika baru ada 1 pesan awal */}
            {messages.length === 1 && (
              <div className={styles.chipsContainer}>
                {SUGGESTIONS.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={styles.chipBtn}
                    onClick={() => handleSendMessage(s)}
                  >
                    <MessageSquare size={11} />
                    <span>{s}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Animasi Indikator Mengetik */}
            {isLoading && (
              <div className={styles.typingRow}>
                <div className={styles.msgAvatar}>
                  <Sparkles size={14} />
                </div>
                <div className={styles.typingBubble}>
                  <span className={styles.typingDot} />
                  <span className={styles.typingDot} />
                  <span className={styles.typingDot} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Formulir Input Pesan */}
          <form className={styles.inputForm} onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text"
              className={styles.chatInput}
              placeholder="Tanyakan fitur, alur kerja, trial..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              maxLength={1000}
            />
            <button
              type="submit"
              className={styles.sendBtn}
              disabled={!input.trim() || isLoading}
              aria-label="Kirim Pesan"
            >
              <Send size={16} />
            </button>
          </form>

          {/* Footer Handover Resmi WhatsApp */}
          <div className={styles.footerHandover}>
            Perlu berbicara dengan tim resmi?
            <a
              href="https://wa.me/628980148297?text=Halo%20Admin%20Fluxa%2C%20saya%20ingin%20konsultasi%20mengenai%20fitur%20dan%20layanan%20Fluxa."
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp Resmi <ArrowUpRight size={12} />
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
