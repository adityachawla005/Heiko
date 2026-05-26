'use client'

import { useRef, useState } from 'react'
import { Loader2, Mic, MicOff } from 'lucide-react'

interface Props {
  draftId: string
  onComplete: () => void
}

export default function VoiceNoteCapture({ draftId, onComplete }: Props) {
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const mrRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const start = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mrRef.current = mr
      chunksRef.current = []
      mr.ondataavailable = e => chunksRef.current.push(e.data)
      mr.onstop = async () => {
        setProcessing(true)
        try {
          const fd = new FormData()
          fd.append('type', 'voice_interview')
          fd.append('file', new File([new Blob(chunksRef.current, { type: 'audio/webm' })], 'note.webm', { type: 'audio/webm' }))
          fd.append('draftId', draftId)
          const res = await fetch('/api/interview/voice', { method: 'POST', body: fd })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || 'Voice processing failed')
          onComplete()
        } catch (e: unknown) {
          setError(e instanceof Error ? e.message : 'Failed to process voice note')
        } finally {
          setProcessing(false)
          stream.getTracks().forEach(t => t.stop())
        }
      }
      mr.start()
      setRecording(true)
    } catch {
      setError('Microphone access denied')
    }
  }

  const stop = () => {
    mrRef.current?.stop()
    setRecording(false)
  }

  return (
    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center' }}>
      <div style={{
        width: '100%', padding: '20px 18px', borderRadius: 16, background: 'var(--surface)',
        border: '1px solid var(--border)', textAlign: 'left',
      }}>
        <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: 'var(--foreground)', marginBottom: 8 }}>
          Record your know-how
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--muted)', lineHeight: 1.55, margin: 0 }}>
          Talk for about a minute  -  warnings, textures, timing, what “done” looks like. No structure needed; we match it to your steps.
        </p>
      </div>

      <button
        type="button"
        onClick={recording ? stop : start}
        disabled={processing}
        style={{
          width: 88, height: 88, borderRadius: '50%', border: 'none', cursor: processing ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: recording ? '#e05555' : 'var(--surface)',
          boxShadow: recording ? '0 0 32px rgba(224,85,85,0.35)' : '0 0 24px rgba(132,87,99,0.2)',
        }}
      >
        {processing ? <Loader2 size={28} className="animate-spin" style={{ color: 'var(--muted)' }} />
          : recording ? <MicOff size={28} style={{ color: '#fff' }} />
          : <Mic size={28} style={{ color: 'var(--pink)' }} />}
      </button>

      <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--muted)' }}>
        {processing ? 'Transcribing & extracting nuance…' : recording ? 'Recording  -  tap to finish' : 'Tap to start'}
      </p>

      {error && <p style={{ fontSize: 12, color: '#f87171', fontFamily: 'var(--font-body)' }}>{error}</p>}
    </div>
  )
}
