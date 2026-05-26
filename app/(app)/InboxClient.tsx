'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronRight, Clock, CheckCircle2, Play, Eye, AlertCircle } from 'lucide-react'
import { createSupabasePublic } from '@/lib/supabase'

interface Task {
  id: string; status: string; current_step: number; total_steps: number
  last_help_question?: string; created_at: string
  package: { title: string; estimated_minutes: number; domain: string }
  sender?: { id: string; name: string }
  executor?: { id: string; name: string }
}

const DOMAIN_EMOJI: Record<string, string> = {
  cooking: '🍳', technical: '💻', medical: '💊',
  assembly: '🔧', admin: '📋', education: '📚', other: '📝',
}

function StatusPill({ status, current, total }: { status: string; current: number; total: number }) {
  if (status === 'completed') return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--mint)', background: 'rgba(146,228,186,0.1)', padding: '3px 8px', borderRadius: 20 }}>
      <CheckCircle2 size={10} /> Done
    </span>
  )
  if (status === 'active') return (
    <span style={{ fontSize: 11, color: 'var(--sage)', background: 'rgba(144,198,127,0.1)', padding: '3px 8px', borderRadius: 20 }}>
      Step {current + 1}/{total}
    </span>
  )
  return <span style={{ fontSize: 11, color: 'var(--muted-2)', background: 'var(--surface-2)', padding: '3px 8px', borderRadius: 20 }}>Pending</span>
}

export default function InboxClient({ userName, userId, inbox, sent }: {
  userName: string; userId: string; inbox: Task[]; sent: Task[]
}) {
  const [tab, setTab] = useState<'inbox' | 'sent'>('inbox')
  const [inboxTasks, setInboxTasks] = useState(inbox)
  const [sentTasks, setSentTasks] = useState(sent)

  useEffect(() => { setInboxTasks(inbox); setSentTasks(sent) }, [inbox, sent])

  useEffect(() => {
    const supabase = createSupabasePublic()
    const refresh = () => {
      fetch('/api/tasks')
        .then(r => r.json())
        .then(data => {
          if (data.inbox) setInboxTasks(data.inbox)
          if (data.sent) setSentTasks(data.sent)
        })
        .catch(() => {})
    }
    const ch = supabase
      .channel(`tasks:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `executor_id=eq.${userId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `sender_id=eq.${userId}` }, refresh)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [userId])

  const stuckTasks = sentTasks.filter(t => t.last_help_question && t.status === 'active')
  const tasks = tab === 'inbox' ? inboxTasks : sentTasks

  return (
    <div style={{ padding: '48px 56px', maxWidth: 900 }}>

      {/* Page header */}
      <div style={{ marginBottom: 40 }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>
          Welcome back
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 32, letterSpacing: '-0.03em', color: 'var(--foreground)' }}>
          {userName}
        </h1>
      </div>

      {/* Stuck alert banner */}
      {stuckTasks.length > 0 && (
        <div style={{ marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {stuckTasks.map(task => (
            <Link key={task.id} href={tab === 'inbox' ? `/task/${task.id}` : `/watch/${task.id}`} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '16px 20px', borderRadius: 14, textDecoration: 'none',
              background: 'rgba(228,145,166,0.07)', border: '1px solid rgba(228,145,166,0.2)',
              transition: 'opacity 0.15s',
            }}>
              <AlertCircle size={18} style={{ color: 'var(--pink)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 13, color: 'var(--pink)' }}>
                  {task.executor?.name} is stuck on <strong>{task.package.title}</strong>
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  "{task.last_help_question}"
                </p>
              </div>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--pink)', flexShrink: 0 }}>Help →</span>
            </Link>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 28, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {(['inbox', 'sent'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-display)', fontWeight: tab === t ? 600 : 400, fontSize: 13,
            letterSpacing: '0.03em', textTransform: 'capitalize',
            color: tab === t ? 'var(--foreground)' : 'var(--muted)',
            borderBottom: tab === t ? '2px solid var(--pink)' : '2px solid transparent',
            marginBottom: -1, transition: 'color 0.15s',
          }}>
            {t === 'inbox' ? 'Inbox' : 'Sent'} <span style={{ fontSize: 11, color: 'var(--muted-2)', marginLeft: 4 }}>{(t === 'inbox' ? inboxTasks : sentTasks).length}</span>
          </button>
        ))}
      </div>

      {/* Task list */}
      {tasks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted)', fontFamily: 'var(--font-body)', fontSize: 14 }}>
          {tab === 'inbox' ? 'No tasks yet. Ask someone to send you a guide.' : 'Nothing sent yet. Use Send to share your knowledge.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {tasks.map(task => (
            <Link
              key={task.id}
              href={tab === 'inbox' ? `/task/${task.id}` : `/watch/${task.id}`}
              style={{
                display: 'grid', gridTemplateColumns: '48px 1fr auto', alignItems: 'center', gap: 20,
                padding: '20px 24px', borderRadius: 14, textDecoration: 'none',
                background: 'var(--surface)', border: '1px solid var(--border)',
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(228,145,166,0.25)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface)' }}
            >
              <span style={{ fontSize: 28 }}>{DOMAIN_EMOJI[task.package.domain] || '📝'}</span>

              <div>
                <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 15, color: 'var(--foreground)', marginBottom: 4 }}>
                  {task.package.title}
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--muted)' }}>
                  {tab === 'inbox' ? `From ${task.sender?.name}` : `→ ${task.executor?.name}`}
                  {' · '}~{task.package.estimated_minutes}m
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <StatusPill status={task.status} current={task.current_step} total={task.total_steps} />
                {tab === 'inbox'
                  ? task.status === 'pending' ? <Play size={15} style={{ color: 'var(--sage)' }} />
                    : task.status === 'active' ? <Clock size={15} style={{ color: 'var(--mint)' }} />
                    : <CheckCircle2 size={15} style={{ color: 'var(--mint)' }} />
                  : <Eye size={15} style={{ color: 'var(--muted)' }} />}
                <ChevronRight size={14} style={{ color: 'var(--muted-2)' }} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
