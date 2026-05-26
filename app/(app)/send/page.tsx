'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import InputCapture from '@/components/sender/InputCapture'
import NuanceInterview from '@/components/sender/NuanceInterview'
import SendModePicker from '@/components/sender/SendModePicker'
import VoiceNoteCapture from '@/components/sender/VoiceNoteCapture'
import { Loader2, UserPlus, Send, Check } from 'lucide-react'
import type { SendMode } from '@/lib/types'
import type { NuanceQuestion } from '@/lib/types'

type Stage = 'input' | 'choose_mode' | 'interview' | 'voice' | 'pick_contact' | 'sending' | 'done'

interface Contact {
  id: string
  contact_id: string
  nickname: string | null
  task_count: number
  contact?: { id: string; name: string } | null
}

interface ParsedData {
  draftId: string
  draft: { title: string; estimatedMinutes: number; steps: unknown[]; domain?: string }
  questions: NuanceQuestion[]
}

const PROGRESS: { key: string; label: string }[] = [
  { key: 'input', label: 'Instructions' },
  { key: 'capture', label: 'Your know-how' },
  { key: 'pick_contact', label: 'Send to' },
]

function executorId(c: Contact): string {
  return c.contact?.id ?? c.contact_id
}

function contactLabel(c: Contact): string {
  return c.nickname || c.contact?.name || 'Contact'
}

function progressIndex(stage: Stage): number {
  if (stage === 'input') return 0
  if (stage === 'choose_mode' || stage === 'interview' || stage === 'voice') return 1
  return 2
}

export default function SendPage() {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>('input')
  const [sendMode, setSendMode] = useState<SendMode | null>(null)
  const [parsedData, setParsedData] = useState<ParsedData | null>(null)
  const [packageId, setPackageId] = useState('')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedContact, setSelectedContact] = useState('')
  const [compileError, setCompileError] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [addingContact, setAddingContact] = useState(false)
  const [sentTaskId, setSentTaskId] = useState('')

  useEffect(() => {
    if (stage === 'pick_contact') {
      fetch('/api/contacts')
        .then(r => r.json())
        .then((data: Contact[]) => setContacts(Array.isArray(data) ? data.filter(c => executorId(c)) : []))
    }
  }, [stage])

  const handleParsed = (draftId: string, draft: unknown, questions: unknown[]) => {
    setParsedData({
      draftId,
      draft: draft as ParsedData['draft'],
      questions: questions as NuanceQuestion[],
    })
    setStage('choose_mode')
  }

  const runCompile = async (mode: SendMode) => {
    if (!parsedData) return
    setSendMode(mode)
    setStage('pick_contact')
    setCompileError('')
    setPackageId('')
    try {
      const res = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId: parsedData.draftId, mode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPackageId(data.packageId)
    } catch (e: unknown) {
      setCompileError(e instanceof Error ? e.message : 'Failed to compile')
    }
  }

  const handleModeSelect = (mode: SendMode) => {
    setSendMode(mode)
    if (mode === 'interview') setStage('interview')
    else if (mode === 'voice') setStage('voice')
    else runCompile('live')
  }

  const handleCaptureComplete = () => runCompile(sendMode || 'interview')

  const handleAddContact = async () => {
    if (!newEmail.trim()) return
    setAddingContact(true)
    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail }),
    })
    const data = await res.json()
    if (res.ok && executorId(data)) {
      setContacts(c => {
        const id = executorId(data)
        if (c.some(x => executorId(x) === id)) return c
        return [...c, data]
      })
      setNewEmail('')
    }
    setAddingContact(false)
  }

  const handleSend = async () => {
    if (!packageId || !selectedContact) return
    setStage('sending')
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageId, executorId: selectedContact }),
    })
    const data = await res.json()
    if (res.ok) {
      setSentTaskId(data.id)
      setStage('done')
      if (sendMode === 'live') {
        setTimeout(() => router.push(`/watch/${data.id}`), 1200)
      } else {
        setTimeout(() => router.push('/inbox'), 2000)
      }
    } else {
      setStage('pick_contact')
    }
  }

  const stageIdx = progressIndex(stage)
  const selectedContactEntry = contacts.find(c => executorId(c) === selectedContact)
  const inp = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--foreground)',
    fontFamily: 'var(--font-body)',
    fontSize: 14,
    borderRadius: 12,
    outline: 'none',
    padding: '12px 16px',
  }

  if (stage === 'done') {
    const live = sendMode === 'live'
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: live ? 'rgba(146,228,186,0.1)' : 'rgba(228,145,166,0.1)', border: `1px solid ${live ? 'rgba(146,228,186,0.25)' : 'rgba(228,145,166,0.25)'}` }}>
          <Check size={30} style={{ color: live ? 'var(--mint)' : 'var(--pink)' }} />
        </div>
        <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, color: 'var(--foreground)' }}>Sent!</p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--muted)', textAlign: 'center', maxWidth: 320 }}>
          {live
            ? 'Opening live view  -  you’ll answer questions in real time as they work.'
            : 'They’ll see it in their Heiko inbox.'}
        </p>
        {live && sentTaskId && (
          <button
            type="button"
            onClick={() => router.push(`/watch/${sentTaskId}`)}
            style={{ marginTop: 8, padding: '12px 24px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', background: 'linear-gradient(135deg, var(--mint), var(--sage))', color: '#08060a' }}
          >
            Open live view
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{ padding: '48px 56px' }}>
      <div style={{ maxWidth: 680 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 32, letterSpacing: '-0.03em', color: 'var(--foreground)', marginBottom: 8 }}>Send</h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--muted)', marginBottom: 36 }}>
          Share your knowledge  -  Heiko turns it into guided steps.
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 40 }}>
          {PROGRESS.map((s, i) => (
            <div key={s.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ height: 3, borderRadius: 4, transition: 'background 0.3s', background: stageIdx >= i ? 'var(--pink)' : 'var(--border)' }} />
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: stageIdx >= i ? 'var(--pink)' : 'var(--muted-2)' }}>{s.label}</span>
            </div>
          ))}
        </div>

        {stage === 'input' && (
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: 'var(--foreground)', marginBottom: 20 }}>Share instructions</h2>
            <InputCapture onParsed={handleParsed} />
          </div>
        )}

        {stage === 'choose_mode' && parsedData && (
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: 'var(--foreground)', marginBottom: 20 }}>Add your know-how</h2>
            <SendModePicker
              questionCount={parsedData.questions.length}
              domain={parsedData.draft.domain}
              onSelect={handleModeSelect}
            />
          </div>
        )}

        {stage === 'interview' && parsedData && (
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: 'var(--foreground)', marginBottom: 20 }}>3 quick questions</h2>
            <NuanceInterview
              draftId={parsedData.draftId}
              questions={parsedData.questions}
              onComplete={handleCaptureComplete}
            />
          </div>
        )}

        {stage === 'voice' && parsedData && (
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: 'var(--foreground)', marginBottom: 20 }}>Voice note</h2>
            <VoiceNoteCapture draftId={parsedData.draftId} onComplete={handleCaptureComplete} />
          </div>
        )}

        {(stage === 'pick_contact' || stage === 'sending') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: 'var(--foreground)' }}>Send to</h2>

            {sendMode === 'live' && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--mint)', padding: '12px 16px', borderRadius: 12, background: 'rgba(146,228,186,0.08)', border: '1px solid rgba(146,228,186,0.2)' }}>
                Live mode  -  after sending, you’ll watch progress and answer questions in real time.
              </p>
            )}

            {compileError && <p style={{ fontSize: 13, color: '#f87171', fontFamily: 'var(--font-body)' }}>{compileError}</p>}

            {!packageId && !compileError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--muted)', fontFamily: 'var(--font-body)', fontSize: 13 }}>
                <Loader2 size={14} className="animate-spin" /> Compiling package…
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {contacts.map(c => {
                const execId = executorId(c)
                const sel = selectedContact === execId
                const label = contactLabel(c)
                return (
                  <button key={c.id} type="button" onClick={() => setSelectedContact(execId)} style={{
                    padding: '16px 20px', borderRadius: 14, border: `1px solid ${sel ? 'var(--pink)' : 'var(--border)'}`,
                    background: sel ? 'rgba(228,145,166,0.1)' : 'var(--surface)',
                    cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8, transition: 'all 0.15s',
                  }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: sel ? 'var(--pink)' : 'var(--mauve)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: '#fff' }}>
                      {label[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div>
                      <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: sel ? 'var(--pink)' : 'var(--foreground)' }}>{label}</p>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--muted)' }}>{c.task_count} tasks shared</p>
                    </div>
                    {sel && <Check size={14} style={{ color: 'var(--pink)', marginLeft: 'auto' }} />}
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Add by email…"
                style={{ ...inp, flex: 1 }}
                onKeyDown={e => e.key === 'Enter' && handleAddContact()} />
              <button type="button" onClick={handleAddContact} disabled={addingContact || !newEmail.trim()}
                style={{ padding: '12px 18px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', cursor: 'pointer', opacity: (addingContact || !newEmail.trim()) ? 0.4 : 1 }}>
                {addingContact ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
              </button>
            </div>

            <button type="button" onClick={handleSend} disabled={!packageId || !selectedContact || stage === 'sending'}
              style={{ padding: '14px 28px', borderRadius: 12, background: 'linear-gradient(135deg, var(--pink), var(--mauve))', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: (!packageId || !selectedContact || stage === 'sending') ? 0.4 : 1, width: 'fit-content' }}>
              {stage === 'sending' ? <><Loader2 size={14} className="animate-spin" /> Sending…</> : <><Send size={14} /> Send to {selectedContactEntry ? contactLabel(selectedContactEntry) : 'contact'}</>}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
