'use client'

import { useEffect, useState, useCallback } from 'react'
import { createSupabasePublic } from '@/lib/supabase'
import { Loader2, MessageSquare, Send } from 'lucide-react'

interface LiveQuestion {
  id: string
  question: string
  step_index: number | null
  answer: string | null
  session_count?: number
  created_at: string
}

interface Props {
  taskId: string
  packageId: string
}

export default function WatchLivePanel({ taskId, packageId }: Props) {
  const [questions, setQuestions] = useState<LiveQuestion[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [sending, setSending] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    fetch(`/api/tasks/${taskId}/live`)
      .then(r => r.json())
      .then(data => {
        if (data.questions) setQuestions(data.questions)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [taskId])

  useEffect(() => {
    load()
    const supabase = createSupabasePublic()
    const ch = supabase
      .channel(`live-q:${packageId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'package_questions', filter: `package_id=eq.${packageId}` },
        () => load()
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [packageId, taskId, load])

  const unanswered = questions.filter(q => !q.answer)
  const answered = questions.filter(q => q.answer)

  const submit = async (qId: string) => {
    const answer = drafts[qId]?.trim()
    if (!answer) return
    setSending(qId)
    const res = await fetch(`/api/tasks/${taskId}/live`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: qId, answer }),
    })
    if (res.ok) {
      setDrafts(d => ({ ...d, [qId]: '' }))
      load()
    }
    setSending(null)
  }

  if (loading) {
    return (
      <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}>
        <Loader2 size={18} className="animate-spin" style={{ color: 'var(--pink)' }} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <MessageSquare size={14} style={{ color: 'var(--mint)' }} />
        <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, color: 'var(--foreground)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Live questions
        </p>
        {unanswered.length > 0 && (
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(228,145,166,0.15)', color: 'var(--pink)' }}>
            {unanswered.length} waiting
          </span>
        )}
      </div>

      {unanswered.length === 0 && answered.length === 0 && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--muted)' }}>
          No questions yet. When they ask something Heiko can’t answer from the guide, it appears here instantly.
        </p>
      )}

      {unanswered.map(q => (
        <div key={q.id} style={{ padding: '16px', borderRadius: 14, background: 'rgba(228,145,166,0.06)', border: '1px solid rgba(228,145,166,0.2)' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>
            {q.step_index != null ? `Step ${q.step_index + 1}` : 'General'}
            {q.session_count && q.session_count > 1 ? ` · asked ${q.session_count}×` : ''}
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--foreground)', lineHeight: 1.5, marginBottom: 12 }}>
            &ldquo;{q.question}&rdquo;
          </p>
          <textarea
            value={drafts[q.id] || ''}
            onChange={e => setDrafts(d => ({ ...d, [q.id]: e.target.value }))}
            placeholder="Your answer  -  saved for every future run in this domain…"
            style={{
              width: '100%', minHeight: 72, padding: '10px 12px', borderRadius: 10, resize: 'vertical',
              background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)',
              fontFamily: 'var(--font-body)', fontSize: 13, outline: 'none', marginBottom: 10,
            }}
          />
          <button
            type="button"
            onClick={() => submit(q.id)}
            disabled={!drafts[q.id]?.trim() || sending === q.id}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10,
              border: 'none', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              background: 'var(--pink)', color: '#08060a', opacity: (!drafts[q.id]?.trim() || sending === q.id) ? 0.4 : 1,
            }}
          >
            {sending === q.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            Send answer
          </button>
        </div>
      ))}

      {answered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Answered</p>
          {answered.slice(0, 5).map(q => (
            <div key={q.id} style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Q: {q.question}</p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--foreground)' }}>A: {q.answer}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
