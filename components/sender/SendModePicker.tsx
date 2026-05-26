'use client'

import { MessageCircle, Mic, Radio } from 'lucide-react'
import type { SendMode } from '@/lib/types'

const MODES: {
  id: SendMode
  icon: React.ReactNode
  title: string
  subtitle: string
  detail: string
  accent: string
}[] = [
  {
    id: 'interview',
    icon: <MessageCircle size={20} />,
    title: 'Quick interview',
    subtitle: '~2 min · 3 questions',
    detail: 'Heiko spots the biggest gaps and asks only what matters.',
    accent: 'var(--pink)',
  },
  {
    id: 'voice',
    icon: <Mic size={20} />,
    title: 'Voice note',
    subtitle: '~60 sec · talk naturally',
    detail: 'Record once  -  we transcribe and pull out the nuance for you.',
    accent: 'var(--mauve)',
  },
  {
    id: 'live',
    icon: <Radio size={20} />,
    title: 'Live while they work',
    subtitle: 'Send now · answer in real time',
    detail: 'They follow the steps; you answer questions as they come in. Gets smarter every time.',
    accent: 'var(--mint)',
  },
]

interface Props {
  questionCount: number
  domain?: string
  onSelect: (mode: SendMode) => void
}

export default function SendModePicker({ questionCount, domain, onSelect }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--muted)', lineHeight: 1.5 }}>
        Instructions parsed
        {domain ? ` · ${domain}` : ''}
        {questionCount > 0 ? ` · ${questionCount} nuance questions ready` : ''}
        . How do you want to add your know-how?
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {MODES.map(m => (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(m.id)}
            style={{
              display: 'grid',
              gridTemplateColumns: '44px 1fr',
              gap: 14,
              padding: '18px 20px',
              borderRadius: 14,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = `${m.accent}55`
              e.currentTarget.style.background = 'var(--surface-2)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.background = 'var(--surface)'
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `color-mix(in srgb, ${m.accent} 18%, transparent)`, color: m.accent,
            }}>
              {m.icon}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--foreground)' }}>
                  {m.title}
                </span>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: m.accent, letterSpacing: '0.04em' }}>
                  {m.subtitle}
                </span>
              </div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--muted)', lineHeight: 1.45, margin: 0 }}>
                {m.detail}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
