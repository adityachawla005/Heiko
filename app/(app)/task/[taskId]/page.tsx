'use client'

import { useState, useEffect, use } from 'react'
import { Loader2 } from 'lucide-react'
import ConversationUI from '@/components/executor/ConversationUI'
import { createSupabasePublic } from '@/lib/supabase'

interface SessionData {
  sessionId: string; welcomeMessage: string; packageTitle: string
  estimatedMinutes: number; totalSteps: number
  stepTimings: { durationSeconds: number; proactiveCheckInSeconds: number | null }[]
}

export default function TaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = use(params)
  const [session, setSession] = useState<SessionData | null>(null)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [complete, setComplete] = useState(false)

  useEffect(() => {
    fetch(`/api/tasks/${taskId}/start`, { method: 'POST' })
      .then(r => r.json())
      .then(data => { setSession({ ...data, stepTimings: data.stepTimings ?? [] }); setLoading(false) })
  }, [taskId])

  const handleStepChange = async (index: number) => {
    setCurrentStepIndex(index)
    await createSupabasePublic().from('tasks').update({ current_step: index, status: 'active' }).eq('id', taskId)
  }

  const handleComplete = async () => {
    setComplete(true)
    await createSupabasePublic().from('tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', taskId)
  }

  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={22} className="animate-spin" style={{ color: 'var(--pink)' }} /></div>

  if (complete) return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(146,228,186,0.1)', border: '1px solid rgba(146,228,186,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>✓</div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: 'var(--foreground)' }}>All done!</h2>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--muted)' }}>{session?.packageTitle} complete.</p>
    </div>
  )

  if (!session) return null

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '20px 40px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--foreground)' }}>{session.packageTitle}</h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>~{session.estimatedMinutes} min · {session.totalSteps} steps</p>
        </div>
      </div>

      {/* Chat  -  constrained width, centred */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 720 }}>
          <ConversationUI
            sessionId={session.sessionId}
            initialMessages={[{ role: 'assistant', content: session.welcomeMessage, timestamp: Date.now() }]}
            currentStepIndex={currentStepIndex} totalSteps={session.totalSteps}
            stepTimings={session.stepTimings} onStepChange={handleStepChange} onComplete={handleComplete}
          />
        </div>
      </div>
    </div>
  )
}
