'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, CheckCircle2, HelpCircle, AlertTriangle, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface Message { role: 'user' | 'assistant'; content: string; timestamp: number }
interface StepTiming { durationSeconds: number; proactiveCheckInSeconds: number | null }
interface Props {
  sessionId: string; initialMessages: Message[]; currentStepIndex: number
  totalSteps: number; stepTimings: StepTiming[]
  onStepChange: (i: number) => void; onComplete: () => void
}

const QUICK = [
  { label: 'Done ✓', icon: <CheckCircle2 size={13} />, value: 'Done ✓' },
  { label: 'Need help', icon: <HelpCircle size={13} />, value: 'I need help with this step' },
  { label: 'Problem', icon: <AlertTriangle size={13} />, value: 'Something went wrong' },
]

export default function ConversationUI({ sessionId, initialMessages, currentStepIndex, totalSteps, stepTimings, onStepChange, onComplete }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const checkInRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stepStartRef = useRef(Date.now())

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, streamingText])

  useEffect(() => {
    if (checkInRef.current) clearTimeout(checkInRef.current)
    stepStartRef.current = Date.now()
    const t = stepTimings?.[currentStepIndex]
    if (!t?.proactiveCheckInSeconds) return
    checkInRef.current = setTimeout(() => {
      if (streaming) return
      const el = Math.floor((Date.now() - stepStartRef.current) / 1000)
      sendMessage(`⏱ ${el}s into this step, ~${Math.max(0, t.durationSeconds - el)}s remaining`)
    }, t.proactiveCheckInSeconds * 1000)
    return () => { if (checkInRef.current) clearTimeout(checkInRef.current) }
  }, [currentStepIndex, stepTimings])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return
    setMessages(p => [...p, { role: 'user', content: text, timestamp: Date.now() }])
    setInput(''); setStreaming(true); setStreamingText('')
    try {
      const res = await fetch('/api/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, message: text }) })
      if (!res.ok || !res.body) throw new Error()
      const reader = res.body.getReader(); const dec = new TextDecoder(); let acc = ''
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        for (const line of dec.decode(value).split('\n')) {
          if (!line.startsWith('data: ')) continue
          const d = JSON.parse(line.slice(6))
          if (d.text) { acc += d.text; setStreamingText(acc) }
          if (d.done) {
            setMessages(p => [...p, { role: 'assistant', content: acc, timestamp: Date.now() }])
            setStreamingText(''); setStreaming(false)
            if (d.isComplete) setTimeout(() => onComplete(), 1000)
            else if (d.stepIndex !== undefined) onStepChange(d.stepIndex)
          }
        }
      }
    } catch {
      setStreaming(false); setStreamingText('')
      setMessages(p => [...p, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.', timestamp: Date.now() }])
    }
  }, [sessionId, streaming, onStepChange, onComplete])

  const pct = Math.round((currentStepIndex / totalSteps) * 100)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Progress */}
      <div style={{ padding: '12px 16px 10px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>Step {currentStepIndex + 1} of {totalSteps}</span>
          <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>{pct}%</span>
        </div>
        <div style={{ height: 3, borderRadius: 4, background: 'var(--surface-2)', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, var(--pink), var(--mauve))', width: `${pct}%`, transition: 'width 0.5s ease' }} />
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: 'min(85%, 520px)', borderRadius: 18, padding: '10px 14px', fontSize: 14, lineHeight: 1.55,
              fontFamily: 'var(--font-body)',
              ...(msg.role === 'user'
                ? { background: 'var(--mauve)', color: '#fff', borderBottomRightRadius: 4 }
                : { background: 'var(--surface)', color: 'var(--foreground)', borderBottomLeftRadius: 4, border: '1px solid var(--border)' }
              )
            }}>
              {msg.role === 'assistant'
                ? <div className="prose prose-invert prose-sm max-w-none prose-p:my-1"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                : msg.content}
            </div>
          </div>
        ))}
        {streamingText && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ maxWidth: 'min(85%, 520px)', borderRadius: 18, borderBottomLeftRadius: 4, padding: '10px 14px', fontSize: 14, background: 'var(--surface)', color: 'var(--foreground)', border: '1px solid var(--border)' }}>
              <div className="prose prose-invert prose-sm max-w-none prose-p:my-1"><ReactMarkdown>{streamingText}</ReactMarkdown></div>
            </div>
          </div>
        )}
        {streaming && !streamingText && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ borderRadius: 18, borderBottomLeftRadius: 4, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <Loader2 size={15} style={{ color: 'var(--muted)', animation: 'spin 1s linear infinite' }} className="animate-spin" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick replies */}
      <div style={{ padding: '0 16px 8px', display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
        {QUICK.map(q => (
          <button key={q.value} onClick={() => sendMessage(q.value)} disabled={streaming}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
              borderRadius: 20, fontSize: 12, fontFamily: 'var(--font-body)',
              background: 'var(--surface)', color: 'var(--muted)',
              border: '1px solid var(--border)', cursor: 'pointer', opacity: streaming ? 0.4 : 1,
            }}>
            {q.icon}{q.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: '0 16px 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 10, background: 'var(--surface)', borderRadius: 16, padding: '10px 12px 10px 16px', border: '1px solid var(--border)', alignItems: 'flex-end' }}>
          <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
            placeholder="Message..." rows={1} disabled={streaming}
            style={{ flex: 1, background: 'transparent', color: 'var(--foreground)', fontSize: 14, fontFamily: 'var(--font-body)', resize: 'none', outline: 'none', maxHeight: 96, opacity: streaming ? 0.5 : 1 }}
            onInput={e => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px' }}
          />
          <button onClick={() => sendMessage(input)} disabled={!input.trim() || streaming}
            style={{ flexShrink: 0, width: 32, height: 32, borderRadius: '50%', background: 'var(--pink)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: (!input.trim() || streaming) ? 0.3 : 1, cursor: 'pointer', border: 'none' }}>
            <Send size={13} style={{ color: '#08060a' }} />
          </button>
        </div>
      </div>
    </div>
  )
}
