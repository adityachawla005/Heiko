'use client'

import { useState, useRef } from 'react'
import { ChevronRight, ChevronLeft, Loader2, Mic, MicOff, Zap } from 'lucide-react'
import { NuanceQuestion } from '@/lib/types'

interface Props {
  draftId: string
  questions: NuanceQuestion[]
  onComplete: () => void
  showVoiceShortcut?: boolean
}

export default function NuanceInterview({ draftId, questions, onComplete, showVoiceShortcut = false }: Props) {
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [voiceMode, setVoiceMode] = useState(false)
  const [recording, setRecording] = useState(false)
  const [voiceProcessing, setVoiceProcessing] = useState(false)
  const mrRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const current = questions[idx]
  const isLast = idx === questions.length - 1
  const progress = ((idx + 1) / questions.length) * 100

  const saveAnswer = async (i: number, answer: string) => {
    const all = Object.entries({ ...answers, [i]: answer }).map(([k, a]) => ({
      question: questions[Number(k)].question, answer: a, stepId: questions[Number(k)].stepId,
    }))
    await fetch('/api/interview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draftId, answers: all }) })
  }

  const handleNext = async () => {
    setSaving(true); await saveAnswer(idx, answers[idx] || ''); setSaving(false)
    if (isLast) handleSubmit(); else setIdx(i => i + 1)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    const all = Object.entries(answers).map(([k, a]) => ({ question: questions[Number(k)].question, answer: a, stepId: questions[Number(k)].stepId }))
    await fetch('/api/interview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draftId, answers: all }) })
    setSubmitting(false); onComplete()
  }

  const startVoice = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream); mrRef.current = mr; chunksRef.current = []
      mr.ondataavailable = e => chunksRef.current.push(e.data)
      mr.onstop = async () => {
        setVoiceProcessing(true)
        const fd = new FormData()
        fd.append('type', 'voice_interview'); fd.append('file', new File([new Blob(chunksRef.current, { type: 'audio/webm' })], 'note.webm', { type: 'audio/webm' })); fd.append('draftId', draftId)
        await fetch('/api/interview/voice', { method: 'POST', body: fd })
        stream.getTracks().forEach(t => t.stop()); setVoiceProcessing(false); onComplete()
      }
      mr.start(); setRecording(true)
    } catch { alert('Microphone access denied') }
  }

  if (!current) return null

  const inputStyle = { width: '100%', background: 'var(--surface-2)', color: 'var(--foreground)', borderRadius: 12, padding: '12px 14px', fontSize: 14, fontFamily: 'var(--font-body)', resize: 'none' as const, outline: 'none', border: '1px solid var(--border)' }

  if (voiceMode) return (
    <div style={{ width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 18px' }}>
        <p style={{ fontSize: 13, color: 'var(--muted)', fontFamily: 'var(--font-body)', lineHeight: 1.6 }}>Talk naturally for ~60 seconds. What should someone know to get this right?</p>
      </div>
      <button onClick={recording ? () => { mrRef.current?.stop(); setRecording(false) } : startVoice} disabled={voiceProcessing}
        style={{ width: 80, height: 80, borderRadius: '50%', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 'none',
          background: recording ? '#e05555' : 'var(--surface)', boxShadow: recording ? '0 0 30px rgba(224,85,85,0.35)' : 'none' }}>
        {voiceProcessing ? <Loader2 size={26} className="animate-spin" style={{ color: 'var(--muted)' }} />
          : recording ? <MicOff size={26} style={{ color: '#fff' }} /> : <Mic size={26} style={{ color: 'var(--pink)' }} />}
      </button>
      <p style={{ fontSize: 13, color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>
        {voiceProcessing ? 'Processing…' : recording ? 'Recording  -  tap to finish' : 'Tap to start'}
      </p>
      <button onClick={() => setVoiceMode(false)} style={{ fontSize: 12, color: 'var(--muted-2)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
        Switch to questions instead
      </button>
    </div>
  )

  return (
    <div style={{ width: '100%' }}>
      {showVoiceShortcut && (
        <button onClick={() => setVoiceMode(true)}
          style={{ width: '100%', marginBottom: 14, padding: '10px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: 12, fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}>
          <Zap size={13} style={{ color: 'var(--sage)' }} />
          Skip questions  -  record a 60s voice note instead
        </button>
      )}

      {/* Progress */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>Question {idx + 1} of {questions.length}</span>
          <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>Step {current.stepOrder}</span>
        </div>
        <div style={{ height: 3, borderRadius: 4, background: 'var(--surface-2)', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, var(--pink), var(--mauve))', width: `${progress}%`, transition: 'width 0.3s ease' }} />
        </div>
      </div>

      {/* Question card */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ fontSize: 14, color: 'var(--foreground)', fontFamily: 'var(--font-body)', fontWeight: 500, lineHeight: 1.5 }}>{current.question}</p>
        {current.context && <p style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>{current.context}</p>}
        <textarea value={answers[idx] || ''} onChange={e => setAnswers(a => ({ ...a, [idx]: e.target.value }))}
          placeholder="Answer naturally  -  like talking to someone standing next to you…"
          style={{ ...inputStyle, height: 120 }} autoFocus />
      </div>

      {/* Nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {idx > 0 && (
          <button onClick={() => setIdx(i => i - 1)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '10px 12px', background: 'none', border: 'none', color: 'var(--muted)', fontSize: 13, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
            <ChevronLeft size={15} /> Back
          </button>
        )}
        <button onClick={() => isLast ? handleSubmit() : setIdx(i => i + 1)}
          style={{ marginLeft: 'auto', padding: '10px 14px', background: 'none', border: 'none', color: 'var(--muted)', fontSize: 13, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
          Skip
        </button>
        <button onClick={handleNext} disabled={saving || submitting}
          style={{ padding: '11px 20px', borderRadius: 12, background: 'var(--pink)', color: '#08060a', fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.04em', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: (saving || submitting) ? 0.4 : 1 }}>
          {(saving || submitting) ? <Loader2 size={14} className="animate-spin" /> : <>{isLast ? 'Finish' : 'Next'}<ChevronRight size={15} /></>}
        </button>
      </div>

      {questions.length > 3 && (
        <button onClick={handleSubmit} disabled={submitting}
          style={{ width: '100%', marginTop: 10, padding: '8px', background: 'none', border: 'none', color: 'var(--muted-2)', fontSize: 11, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
          Skip remaining and finish
        </button>
      )}
    </div>
  )
}
