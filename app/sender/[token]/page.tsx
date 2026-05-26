'use client'

import { useEffect, useState, use } from 'react'
import { Loader2, MessageSquare, CheckCircle2, Send } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

interface Question {
  id: string
  question: string
  answer: string | null
  step_index: number
  session_count: number
  answered_at: string | null
}

const P = { pink: '#E491A6', mauve: '#845763', mint: '#92E4BA' }

export default function SenderFeedbackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [title, setTitle] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch(`/api/feedback?token=${token}`)
      .then(r => r.json())
      .then(data => {
        setTitle(data.pkg?.title || '')
        setQuestions(data.questions || [])
      })
      .finally(() => setLoading(false))
  }, [token])

  const unanswered = questions.filter(q => !q.answered_at)
  const answered = questions.filter(q => q.answered_at)

  const handleSubmit = async () => {
    const toSubmit = Object.entries(answers)
      .filter(([, v]) => v.trim())
      .map(([id, answer]) => ({ id, answer }))

    if (!toSubmit.length) return
    setSaving(true)

    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, answers: toSubmit }),
    })

    setSaving(false)
    setSaved(true)
    const data = await fetch(`/api/feedback?token=${token}`).then(r => r.json())
    setQuestions(data.questions || [])
    setAnswers({})
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--pink)' }} />
      </div>
    )
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid var(--border)', padding: '20px 32px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <Image src="/logo.png" alt="Heiko" width={26} height={26} style={{ borderRadius: 7 }} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, letterSpacing: '0.06em', color: 'var(--foreground)' }}>HEIKO</span>
        </Link>
      </header>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '40px 24px 64px' }}>
        <div style={{ width: '100%', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* Page title */}
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, letterSpacing: '-0.03em', color: 'var(--foreground)', marginBottom: 6 }}>
              {title || 'Feedback'}
            </h1>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--muted)', lineHeight: 1.5 }}>
              Questions your executors asked that Heiko couldn't fully answer. Answer once  -  stored permanently for this guide and domain.
            </p>
          </div>

          {unanswered.length === 0 && answered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '64px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <MessageSquare size={28} style={{ color: 'var(--muted-2)' }} />
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--muted)' }}>
                No questions yet. Share your guide and questions will appear here as people use it.
              </p>
            </div>
          )}

          {unanswered.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--muted-2)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Needs your answer ({unanswered.length})
              </p>

              {unanswered.map(q => (
                <div key={q.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--foreground)', lineHeight: 1.5 }}>{q.question}</p>
                    {q.session_count > 1 && (
                      <span style={{ flexShrink: 0, fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--muted)', background: 'var(--surface-2)', padding: '3px 10px', borderRadius: 20 }}>
                        asked {q.session_count}×
                      </span>
                    )}
                  </div>
                  <textarea
                    value={answers[q.id] || ''}
                    onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                    placeholder="Answer naturally  -  like you're standing next to them..."
                    style={{
                      width: '100%', minHeight: 88, padding: '12px 14px', borderRadius: 12, resize: 'vertical',
                      background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)',
                      fontFamily: 'var(--font-body)', fontSize: 14, outline: 'none',
                    }}
                  />
                </div>
              ))}

              <button
                onClick={handleSubmit}
                disabled={saving || !Object.values(answers).some(v => v.trim())}
                style={{
                  width: '100%', padding: '14px 20px', borderRadius: 14, border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, letterSpacing: '0.08em',
                  textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: `linear-gradient(135deg, ${P.pink}, ${P.mauve})`, color: '#fff',
                  opacity: (saving || !Object.values(answers).some(v => v.trim())) ? 0.45 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                {saving ? (
                  <><Loader2 size={15} className="animate-spin" /> Saving...</>
                ) : saved ? (
                  <><CheckCircle2 size={15} style={{ color: P.mint }} /> Saved  -  package updated</>
                ) : (
                  <><Send size={15} /> Save answers</>
                )}
              </button>
            </div>
          )}

          {answered.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--muted-2)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Already answered ({answered.length})
              </p>
              {answered.map(q => (
                <div key={q.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--muted)' }}>Q: {q.question}</p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--foreground)' }}>A: {q.answer}</p>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </main>
  )
}
