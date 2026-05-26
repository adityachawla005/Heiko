'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, Link, Mic, FileText, Type, Loader2, MicOff } from 'lucide-react'

interface Props { onParsed: (draftId: string, draft: unknown, questions: unknown[]) => void }
type InputMode = 'text' | 'image' | 'pdf' | 'url' | 'voice'

const MODES: { id: InputMode; icon: React.ReactNode; label: string }[] = [
  { id: 'text',  icon: <Type size={15} />,     label: 'Text' },
  { id: 'image', icon: <Upload size={15} />,   label: 'Image' },
  { id: 'pdf',   icon: <FileText size={15} />, label: 'PDF' },
  { id: 'url',   icon: <Link size={15} />,     label: 'URL' },
  { id: 'voice', icon: <Mic size={15} />,      label: 'Voice' },
]

export default function InputCapture({ onParsed }: Props) {
  const [mode, setMode] = useState<InputMode>('text')
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [recording, setRecording] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const submit = useCallback(async (fd: FormData) => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/parse', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to parse')
      onParsed(data.draftId, data.draft, data.questions)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally { setLoading(false) }
  }, [onParsed])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const fd = new FormData(); fd.append('type', mode); fd.append('file', file); submit(fd)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]; if (!file) return
    const fd = new FormData(); fd.append('type', file.type.includes('pdf') ? 'pdf' : 'image'); fd.append('file', file); submit(fd)
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream); mediaRecorderRef.current = mr; audioChunksRef.current = []
      mr.ondataavailable = e => audioChunksRef.current.push(e.data)
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const fd = new FormData(); fd.append('type', 'voice'); fd.append('file', new File([blob], 'voice.webm', { type: 'audio/webm' }))
        submit(fd); stream.getTracks().forEach(t => t.stop())
      }
      mr.start(); setRecording(true)
    } catch { setError('Microphone access denied') }
  }

  const s = { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)', fontFamily: 'var(--font-body)' }

  return (
    <div style={{ width: '100%' }}>
      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, background: 'var(--surface)', padding: 4, borderRadius: 12, border: '1px solid var(--border)' }}>
        {MODES.map(m => (
          <button key={m.id} onClick={() => setMode(m.id)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '8px 4px', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-body)',
              fontWeight: mode === m.id ? 600 : 400,
              background: mode === m.id ? 'var(--pink)' : 'transparent',
              color: mode === m.id ? '#08060a' : 'var(--muted)',
              border: 'none', cursor: 'pointer', transition: 'all 0.15s',
            }}>
            {m.icon}{m.label}
          </button>
        ))}
      </div>

      {/* Input area */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {mode === 'text' && <>
          <textarea value={text} onChange={e => setText(e.target.value)}
            placeholder="Paste or type your instructions  -  recipe, runbook, manual, anything..."
            style={{ ...s, width: '100%', height: 180, borderRadius: 12, padding: '14px 16px', fontSize: 14, resize: 'none', outline: 'none' }} />
          <button onClick={() => { const fd = new FormData(); fd.append('type','text'); fd.append('text',text); submit(fd) }}
            disabled={!text.trim() || loading} suppressHydrationWarning
            style={{ width: '100%', padding: '13px', borderRadius: 12, fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: 'var(--pink)', color: '#08060a', border: 'none', cursor: 'pointer', opacity: (!text.trim() || loading) ? 0.4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {loading ? <><Loader2 size={15} className="animate-spin" /> Analysing...</> : 'Analyse Instructions →'}
          </button>
        </>}

        {mode === 'url' && <>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..."
            style={{ ...s, width: '100%', borderRadius: 12, padding: '14px 16px', fontSize: 14, outline: 'none' }}
            onKeyDown={e => { if (e.key === 'Enter') { const fd = new FormData(); fd.append('type','url'); fd.append('url',url); submit(fd) } }} />
          <button onClick={() => { const fd = new FormData(); fd.append('type','url'); fd.append('url',url); submit(fd) }}
            disabled={!url.trim() || loading} suppressHydrationWarning
            style={{ width: '100%', padding: '13px', borderRadius: 12, fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: 'var(--pink)', color: '#08060a', border: 'none', cursor: 'pointer', opacity: (!url.trim() || loading) ? 0.4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {loading ? <><Loader2 size={15} className="animate-spin" /> Scraping...</> : 'Extract Instructions →'}
          </button>
        </>}

        {(mode === 'image' || mode === 'pdf') && (
          <div onDrop={handleDrop} onDragOver={e => e.preventDefault()} onClick={() => fileInputRef.current?.click()}
            style={{ ...s, borderRadius: 14, padding: '48px 24px', textAlign: 'center', cursor: 'pointer', borderStyle: 'dashed', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            {loading
              ? <><Loader2 size={28} className="animate-spin" style={{ color: 'var(--pink)' }} /><span style={{ fontSize: 13, color: 'var(--muted)' }}>{mode === 'pdf' ? 'Extracting PDF...' : 'Reading image...'}</span></>
              : <>{mode === 'pdf' ? <FileText size={28} style={{ color: 'var(--muted)' }} /> : <Upload size={28} style={{ color: 'var(--muted)' }} />}
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>Drop {mode === 'pdf' ? 'PDF' : 'image'} here or click to browse</p>
                <p style={{ fontSize: 11, color: 'var(--muted-2)' }}>{mode === 'pdf' ? '.pdf files' : '.jpg .png .webp'}</p></>}
            <input ref={fileInputRef} type="file" style={{ display: 'none' }} accept={mode === 'pdf' ? '.pdf' : 'image/*'} onChange={handleFile} />
          </div>
        )}

        {mode === 'voice' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '32px 0' }}>
            <button onClick={recording ? () => { mediaRecorderRef.current?.stop(); setRecording(false) } : startRecording} disabled={loading}
              style={{ width: 80, height: 80, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 'none', transition: 'all 0.2s',
                background: recording ? '#e05555' : 'var(--surface)', boxShadow: recording ? '0 0 30px rgba(224,85,85,0.4)' : 'none' }}>
              {loading ? <Loader2 size={26} className="animate-spin" style={{ color: 'var(--muted)' }} />
                : recording ? <MicOff size={26} style={{ color: '#fff' }} />
                : <Mic size={26} style={{ color: 'var(--pink)' }} />}
            </button>
            <p style={{ fontSize: 13, color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>
              {loading ? 'Transcribing...' : recording ? 'Recording  -  tap to stop' : 'Tap to record'}
            </p>
          </div>
        )}

        {error && <p style={{ fontSize: 12, color: '#f87171', textAlign: 'center', fontFamily: 'var(--font-body)' }}>{error}</p>}
      </div>
    </div>
  )
}
