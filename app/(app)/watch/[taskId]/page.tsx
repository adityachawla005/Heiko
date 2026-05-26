'use client'

import { useState, useEffect, use } from 'react'
import { createSupabasePublic } from '@/lib/supabase'
import { Loader2, CheckCircle2, MessageSquare } from 'lucide-react'
import WatchLivePanel from '@/components/sender/WatchLivePanel'

interface Task {
  id: string; status: string; current_step: number; total_steps: number; package_id: string
  last_help_question?: string; started_at: string | null; completed_at: string | null
  package: { id: string; title: string; estimated_minutes: number; send_mode?: string; steps: { instruction: string }[] }
  executor: { name: string }
}

export default function WatchPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = use(params)
  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createSupabasePublic()
    supabase.from('tasks').select('*, package:instruction_packages(id,title,estimated_minutes,send_mode,steps), executor:profiles!tasks_executor_id_fkey(name)').eq('id', taskId).single()
      .then(({ data }) => { setTask(data); setLoading(false) })
    const ch = supabase.channel(`task:${taskId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks', filter: `id=eq.${taskId}` }, p => setTask(prev => prev ? { ...prev, ...p.new } : null))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [taskId])

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={22} className="animate-spin" style={{ color: 'var(--pink)' }} /></div>
  if (!task) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--muted)' }}>Task not found</div>

  const steps = task.package?.steps || []
  const progress = task.total_steps > 0 ? Math.round((task.current_step / task.total_steps) * 100) : 0

  return (
    <div style={{ padding: '48px 56px' }}>
      <div style={{ maxWidth: 900, display: 'grid', gridTemplateColumns: '1fr 320px', gap: 40, alignItems: 'start' }}>

        {/* Left  -  status */}
        <div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Watching</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, letterSpacing: '-0.03em', color: 'var(--foreground)', marginBottom: 4 }}>{task.package?.title}</h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--muted)', marginBottom: 36 }}>{task.executor?.name}</p>

          {task.status === 'completed' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '20px 24px', borderRadius: 16, background: 'rgba(146,228,186,0.07)', border: '1px solid rgba(146,228,186,0.2)', marginBottom: 24 }}>
              <CheckCircle2 size={22} style={{ color: 'var(--mint)', flexShrink: 0 }} />
              <div>
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--mint)' }}>Completed</p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{task.completed_at ? `Finished at ${new Date(task.completed_at).toLocaleTimeString()}` : 'Just finished'}</p>
              </div>
            </div>
          ) : task.status === 'pending' ? (
            <div style={{ padding: '20px 24px', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 24, fontSize: 14, color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>
              Waiting for {task.executor?.name} to start…
            </div>
          ) : (
            <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--muted)' }}>Step {task.current_step + 1} of {task.total_steps}</span>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--sage)' }}>{progress}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 6, background: 'var(--surface-2)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 6, background: 'linear-gradient(90deg, var(--mint), var(--sage))', width: `${progress}%`, transition: 'width 0.7s ease' }} />
              </div>
              {steps[task.current_step] && (
                <div style={{ padding: '16px 20px', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Currently on</p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--foreground)', lineHeight: 1.55 }}>{steps[task.current_step].instruction}</p>
                </div>
              )}
            </div>
          )}

          {task.last_help_question && task.status === 'active' && (
            <div style={{ padding: '16px 20px', borderRadius: 14, background: 'rgba(228,145,166,0.07)', border: '1px solid rgba(228,145,166,0.2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <MessageSquare size={13} style={{ color: 'var(--pink)' }} />
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 12, color: 'var(--pink)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{task.executor?.name} asked for help</p>
              </div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--foreground)', lineHeight: 1.5 }}>"{task.last_help_question}"</p>
            </div>
          )}
        </div>

        {/* Right  -  live Q&A + steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 24 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px' }}>
            <WatchLivePanel taskId={taskId} packageId={task.package?.id || task.package_id} />
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 12, color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>Steps</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {steps.map((step, i) => {
                const done = i < task.current_step || task.status === 'completed'
                const active = i === task.current_step && task.status === 'active'
                return (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 12px', borderRadius: 10, background: active ? 'rgba(228,145,166,0.08)' : 'transparent', border: active ? '1px solid rgba(228,145,166,0.15)' : '1px solid transparent' }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700,
                      background: done ? 'rgba(146,228,186,0.12)' : active ? 'var(--pink)' : 'var(--surface-2)',
                      color: done ? 'var(--mint)' : active ? '#08060a' : 'var(--muted)',
                    }}>
                      {done ? '✓' : i + 1}
                    </div>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: 1.5, color: done ? 'var(--muted-2)' : active ? 'var(--foreground)' : 'var(--muted)', textDecoration: done ? 'line-through' : 'none' }}>
                      {step.instruction}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
