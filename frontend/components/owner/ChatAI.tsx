'use client'

import { useState, useRef, useEffect } from 'react'
import { Bot, X, Send, Minimize2, Maximize2, Sparkles, ChevronRight, RotateCcw } from 'lucide-react'
import Link from 'next/link'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const STARTER_QUESTIONS = [
  'Mengapa laba saya turun bulan ini?',
  'Siapa pelanggan yang masih punya kasbon?',
  'Produk mana yang stoknya menipis?',
  'Bagaimana kondisi kas bisnis saya saat ini?',
  'Apa yang harus saya lakukan untuk meningkatkan omzet?',
]

function FormattedMessage({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13.5, lineHeight: 1.65 }}>
      {lines.map((line, idx) => {
        const trimmed = line.trim()
        if (!trimmed) return <div key={idx} style={{ height: 4 }} />

        if (trimmed.startsWith('## ')) return (
          <div key={idx} style={{ fontWeight: 800, fontSize: 14, color: '#0f1a3e', borderBottom: '1px solid #e5e9f2', paddingBottom: 4, marginTop: 8 }}>
            {trimmed.replace('## ', '')}
          </div>
        )
        if (trimmed.startsWith('### ')) return (
          <div key={idx} style={{ fontWeight: 700, fontSize: 13, color: '#2F6BFF', marginTop: 6 }}>
            {trimmed.replace('### ', '')}
          </div>
        )
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const content = trimmed.substring(2)
          return (
            <div key={idx} style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
              <span style={{ color: '#2F6BFF', fontWeight: 700, marginTop: 1, flexShrink: 0 }}>•</span>
              <span dangerouslySetInnerHTML={{ __html: content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            </div>
          )
        }
        if (/^\d+\.\s/.test(trimmed)) {
          const match = trimmed.match(/^(\d+\.)\s(.*)/)
          if (match) return (
            <div key={idx} style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
              <span style={{ color: '#2F6BFF', fontWeight: 700, flexShrink: 0, minWidth: 18 }}>{match[1]}</span>
              <span dangerouslySetInnerHTML={{ __html: match[2].replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            </div>
          )
        }
        return (
          <p key={idx} style={{ margin: 0 }}
            dangerouslySetInnerHTML={{ __html: trimmed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
        )
      })}
    </div>
  )
}

export default function ChatAI() {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showStarters, setShowStarters] = useState(true)
  const [unread, setUnread] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (open) {
      setUnread(0)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  async function sendMessage(text?: string) {
    const content = (text || input).trim()
    if (!content || loading) return

    setInput('')
    setShowStarters(false)
    setLoading(true)

    const userMsg: Message = { role: 'user', content, timestamp: new Date() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)

    try {
      const res = await fetch('/api/chat-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages.map(m => ({ role: m.role, content: m.content })) }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `⚠️ ${data.error || 'Terjadi kesalahan. Silakan coba lagi.'}`,
          timestamp: new Date(),
        }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply, timestamp: new Date() }])
        if (!open) setUnread(u => u + 1)
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ Gagal terhubung ke FluxAI. Periksa koneksi internet Anda.',
        timestamp: new Date(),
      }])
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function resetChat() {
    setMessages([])
    setShowStarters(true)
    setInput('')
  }

  const chatWidth = expanded ? 520 : 380
  const chatHeight = expanded ? 640 : 520

  return (
    <>
      <style>{`
        @keyframes chatPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(47, 107, 255, 0.4); }
          50% { box-shadow: 0 0 0 10px rgba(47, 107, 255, 0); }
        }
        @keyframes chatSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes typingDot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        .chat-bubble-fab:hover { transform: scale(1.07) !important; }
        .chat-msg-user { animation: chatSlideUp 0.2s ease; }
        .chat-msg-ai { animation: chatSlideUp 0.25s ease; }
        .chat-starter-btn:hover { background: #2F6BFF !important; color: #fff !important; border-color: #2F6BFF !important; }
        .chat-send-btn:hover:not(:disabled) { background: #1a55e3 !important; transform: scale(1.05); }
        .chat-input-area:focus-within { border-color: #2F6BFF !important; box-shadow: 0 0 0 3px rgba(47,107,255,0.15) !important; }
      `}</style>

      {/* Floating Action Button */}
      <button
        id="fluxai-chat-fab"
        className="chat-bubble-fab"
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
          width: 58, height: 58, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #2F6BFF 0%, #1a3fa8 100%)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(47,107,255,0.45)',
          transition: 'transform 0.2s ease',
          animation: unread > 0 ? 'chatPulse 2s infinite' : 'none',
        }}
        title="Tanya FluxAI"
      >
        {open ? <X size={22} /> : <Bot size={24} />}
        {unread > 0 && !open && (
          <span style={{
            position: 'absolute', top: -2, right: -2, width: 18, height: 18,
            background: '#ef4444', borderRadius: '50%', fontSize: 11, fontWeight: 700,
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #fff',
          }}>{unread}</span>
        )}
      </button>

      {/* Chat Window */}
      {open && (
        <div
          id="fluxai-chat-window"
          style={{
            position: 'fixed', bottom: 98, right: 28, zIndex: 9998,
            width: chatWidth, height: chatHeight,
            background: '#fff', borderRadius: 20,
            boxShadow: '0 24px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            animation: 'chatSlideUp 0.25s ease',
            border: '1px solid #e5e9f2',
          }}
        >
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #0f1a3e 0%, #1a2d6b 100%)',
            padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12,
            flexShrink: 0, position: 'relative', overflow: 'hidden',
          }}>
            {/* Glow blob */}
            <div style={{
              position: 'absolute', top: -20, right: -20, width: 80, height: 80,
              borderRadius: '50%', background: 'rgba(47,107,255,0.3)', filter: 'blur(30px)', pointerEvents: 'none',
            }} />

            <div style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              background: 'linear-gradient(135deg, #2F6BFF, #63b3ed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 16px rgba(47,107,255,0.6)',
            }}>
              <Bot size={20} color="#fff" />
            </div>

            <div style={{ flex: 1, zIndex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                FluxAI
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 8,
                  background: 'rgba(47,107,255,0.4)', color: '#90cdf4', letterSpacing: 0.5,
                }}>AI BISNIS</span>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
                Terhubung ke data bisnis Anda
              </div>
            </div>

            <div style={{ display: 'flex', gap: 4, zIndex: 1 }}>
              <button
                onClick={resetChat}
                title="Reset percakapan"
                style={{
                  background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8,
                  width: 30, height: 30, color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
              >
                <RotateCcw size={13} />
              </button>
              <button
                onClick={() => setExpanded(e => !e)}
                title={expanded ? 'Perkecil' : 'Perbesar'}
                style={{
                  background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8,
                  width: 30, height: 30, color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
              >
                {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>
              <button
                onClick={() => setOpen(false)}
                title="Tutup"
                style={{
                  background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8,
                  width: 30, height: 30, color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Messages area */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '16px 16px 8px',
            display: 'flex', flexDirection: 'column', gap: 12,
            scrollbarWidth: 'thin', scrollbarColor: '#e5e9f2 transparent',
          }}>
            {/* Welcome message */}
            {messages.length === 0 && (
              <div className="chat-msg-ai" style={{
                background: 'linear-gradient(135deg, #f0f5ff, #e8efff)',
                border: '1px solid #d1dffe', borderRadius: 16, padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Sparkles size={15} color="#2F6BFF" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1a2d6b' }}>
                    Halo! Saya FluxAI — Asisten Bisnis Anda 👋
                  </span>
                </div>
                <p style={{ fontSize: 13, color: '#4a5568', margin: 0, lineHeight: 1.6 }}>
                  Saya siap membantu menganalisis kondisi keuangan, stok, piutang, dan performa bisnis toko Anda
                  berdasarkan data real-time dari sistem.
                </p>
                <Link
                  href="/owner/rapor"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 10,
                    fontSize: 12, fontWeight: 700, color: '#2F6BFF', textDecoration: 'none',
                  }}
                >
                  Lihat Laporan Lengkap AI <ChevronRight size={13} />
                </Link>
              </div>
            )}

            {/* Starter questions */}
            {showStarters && messages.length === 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#9ba3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Pertanyaan Populer
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {STARTER_QUESTIONS.map((q, i) => (
                    <button
                      key={i}
                      className="chat-starter-btn"
                      onClick={() => sendMessage(q)}
                      style={{
                        background: '#fff', border: '1px solid #e5e9f2', borderRadius: 10,
                        padding: '9px 12px', cursor: 'pointer', textAlign: 'left',
                        fontSize: 12.5, color: '#374151', fontWeight: 500,
                        display: 'flex', alignItems: 'center', gap: 8,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <ChevronRight size={13} style={{ color: '#2F6BFF', flexShrink: 0 }} />
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Chat messages */}
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={msg.role === 'user' ? 'chat-msg-user' : 'chat-msg-ai'}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  alignItems: 'flex-start', gap: 8,
                }}
              >
                {msg.role === 'assistant' && (
                  <div style={{
                    width: 28, height: 28, borderRadius: 8, flexShrink: 0, marginTop: 2,
                    background: 'linear-gradient(135deg, #2F6BFF, #63b3ed)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Bot size={14} color="#fff" />
                  </div>
                )}

                <div style={{
                  maxWidth: '80%', padding: '10px 14px', borderRadius: msg.role === 'user'
                    ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg, #2F6BFF, #1a55e3)' : '#f8f9fc',
                  color: msg.role === 'user' ? '#fff' : '#1a202c',
                  border: msg.role === 'user' ? 'none' : '1px solid #e5e9f2',
                  fontSize: 13.5,
                }}>
                  {msg.role === 'user'
                    ? <span>{msg.content}</span>
                    : <FormattedMessage text={msg.content} />
                  }
                  <div style={{
                    fontSize: 10, marginTop: 4,
                    color: msg.role === 'user' ? 'rgba(255,255,255,0.6)' : '#9ba3af',
                    textAlign: 'right',
                  }}>
                    {msg.timestamp.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="chat-msg-ai" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: 'linear-gradient(135deg, #2F6BFF, #63b3ed)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Bot size={14} color="#fff" />
                </div>
                <div style={{
                  background: '#f8f9fc', border: '1px solid #e5e9f2', borderRadius: '4px 16px 16px 16px',
                  padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{
                      width: 7, height: 7, borderRadius: '50%', background: '#2F6BFF', display: 'block',
                      animation: `typingDot 1.2s ease ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div style={{
            padding: '12px 14px', borderTop: '1px solid #e5e9f2', flexShrink: 0, background: '#fff',
          }}>
            <div
              className="chat-input-area"
              style={{
                display: 'flex', alignItems: 'flex-end', gap: 10,
                background: '#f8f9fc', border: '1.5px solid #e5e9f2', borderRadius: 14,
                padding: '8px 8px 8px 14px', transition: 'all 0.2s ease',
              }}
            >
              <textarea
                ref={inputRef}
                id="fluxai-chat-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Tanya apa saja tentang bisnis Anda..."
                rows={1}
                disabled={loading}
                style={{
                  flex: 1, border: 'none', outline: 'none', background: 'transparent',
                  fontSize: 13.5, resize: 'none', lineHeight: 1.5, maxHeight: 120,
                  overflowY: 'auto', fontFamily: 'inherit', color: '#1a202c',
                  scrollbarWidth: 'none',
                }}
                onInput={e => {
                  const t = e.currentTarget
                  t.style.height = 'auto'
                  t.style.height = Math.min(t.scrollHeight, 120) + 'px'
                }}
              />
              <button
                id="fluxai-chat-send"
                className="chat-send-btn"
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                style={{
                  width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: loading || !input.trim() ? '#e5e9f2' : '#2F6BFF',
                  color: loading || !input.trim() ? '#9ba3af' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'all 0.15s ease',
                }}
              >
                <Send size={16} />
              </button>
            </div>
            <div style={{ fontSize: 10.5, color: '#c4c9d4', textAlign: 'center', marginTop: 7 }}>
              FluxAI menggunakan data real dari database toko Anda • Enter untuk kirim
            </div>
          </div>
        </div>
      )}
    </>
  )
}
