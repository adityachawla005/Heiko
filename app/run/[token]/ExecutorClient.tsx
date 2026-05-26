'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, PartyPopper, RotateCcw } from 'lucide-react'
import ConversationUI from '@/components/executor/ConversationUI'

interface StepTiming {
  durationSeconds: number
  proactiveCheckInSeconds: number | null
}

interface SessionData {
  sessionId: string
  welcomeMessage: string
  packageTitle: string
  estimatedMinutes: number
  totalSteps: number
  stepTimings: StepTiming[]
}

type Stage = 'loading' | 'ready' | 'executing' | 'complete' | 'error'

export default function ExecutorClient({ token }: { token: string }) {
  const [stage, setStage] = useState<Stage>('loading')
  const [session, setSession] = useState<SessionData | null>(null)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [error, setError] = useState('')

  const initSession = useCallback(async () => {
    setStage('loading')
    try {
      const existingSessionId = typeof window !== 'undefined'
        ? localStorage.getItem(`heiko_session_${token}`)
        : null

      const url = `/api/execute?token=${token}${existingSessionId ? `&sessionId=${existingSessionId}` : ''}`
      const res = await fetch(url)
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed to load guide')

      if (typeof window !== 'undefined') {
        localStorage.setItem(`heiko_session_${token}`, data.sessionId)
      }

      setSession({ ...data, stepTimings: data.stepTimings ?? [] })
      setStage('ready')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load guide')
      setStage('error')
    }
  }, [token])

  useEffect(() => {
    initSession()
  }, [initSession])

  const handleStart = () => {
    setStage('executing')
  }

  const handleComplete = () => {
    setStage('complete')
  }

  if (stage === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'var(--bg)' }}>
        <Loader2 size={28} className="animate-spin" style={{ color: 'var(--pink)' }} />
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--muted)' }}>Loading your guide...</p>
      </div>
    )
  }

  if (stage === 'error') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '0 24px', textAlign: 'center', background: 'var(--bg)' }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--foreground)' }}>{error || 'This guide could not be found.'}</p>
        <button onClick={initSession} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
          <RotateCcw size={14} /> Try again
        </button>
      </div>
    )
  }

  if (stage === 'complete') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '0 24px', textAlign: 'center', background: 'var(--bg)' }}>
        <PartyPopper size={40} style={{ color: 'var(--mint)' }} />
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: 'var(--foreground)', marginBottom: 6 }}>All done!</h2>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--muted)' }}>{session?.packageTitle} complete.</p>
        </div>
        <button
          onClick={() => {
            if (typeof window !== 'undefined') {
              localStorage.removeItem(`heiko_session_${token}`)
            }
            initSession()
          }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 13, color: 'var(--muted-2)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
        >
          <RotateCcw size={13} /> Run again from the start
        </button>
      </div>
    )
  }

  if (stage === 'ready' && session) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'var(--bg)' }}>
        <div style={{ width: '100%', maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', fontSize: 24 }}>
              👋
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, letterSpacing: '-0.02em', color: 'var(--foreground)' }}>{session.packageTitle}</h1>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--muted)' }}>
              {session.totalSteps} steps · ~{session.estimatedMinutes} min
            </p>
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 24px' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--foreground)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
              {session.welcomeMessage}
            </p>
          </div>

          <button
            onClick={handleStart}
            style={{ width: '100%', padding: '15px 20px', background: 'linear-gradient(135deg, var(--pink), var(--mauve))', color: '#fff', border: 'none', borderRadius: 14, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}
          >
            Let's go →
          </button>
        </div>
      </div>
    )
  }

  if (stage === 'executing' && session) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        <header style={{ padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {session.packageTitle}
          </span>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--muted)', flexShrink: 0, marginLeft: 24 }}>
            ~{session.estimatedMinutes}m
          </span>
        </header>

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 780 }}>
            <ConversationUI
              sessionId={session.sessionId}
              initialMessages={[
                {
                  role: 'assistant',
                  content: session.welcomeMessage,
                  timestamp: Date.now(),
                },
              ]}
              currentStepIndex={currentStepIndex}
              totalSteps={session.totalSteps}
              stepTimings={session.stepTimings}
              onStepChange={setCurrentStepIndex}
              onComplete={handleComplete}
            />
          </div>
        </div>
      </div>
    )
  }

  return null
}
