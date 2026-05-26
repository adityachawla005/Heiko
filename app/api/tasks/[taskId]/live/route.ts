import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { getUser } from '@/lib/auth'
import { invalidatePackage } from '@/lib/redis'
import { recordDomainLearning } from '@/lib/domain-knowledge'
import type { Step } from '@/lib/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createSupabaseAdmin()
  const { data: task } = await supabase
    .from('tasks')
    .select('*, package:instruction_packages(id, share_token, title, domain, send_mode)')
    .eq('id', taskId)
    .eq('sender_id', user.id)
    .single()

  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const packageId = task.package_id || task.package?.id
  const { data: questions } = await supabase
    .from('package_questions')
    .select('*')
    .eq('package_id', packageId)
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({
    task,
    questions: questions || [],
    unanswered: (questions || []).filter((q: { answer: string | null }) => !q.answer),
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { questionId, answer } = await req.json()
  if (!questionId || !answer?.trim()) {
    return NextResponse.json({ error: 'Missing data' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const { data: task } = await supabase
    .from('tasks')
    .select('*, package:instruction_packages(share_token, domain, steps)')
    .eq('id', taskId)
    .eq('sender_id', user.id)
    .single()

  if (!task?.package) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const token = task.package.share_token
  const now = new Date().toISOString()

  const { data: qRow } = await supabase
    .from('package_questions')
    .update({ answer: answer.trim(), answered_at: now })
    .eq('id', questionId)
    .eq('package_id', task.package_id)
    .select('question, step_index')
    .single()

  if (!qRow) return NextResponse.json({ error: 'Question not found' }, { status: 404 })

  const { data: answered } = await supabase
    .from('package_questions')
    .select('*')
    .eq('share_token', token)
    .not('answer', 'is', null)

  if (answered?.length) {
    const steps = task.package.steps as Step[]
    answered.forEach(q => {
      const step = steps.find((_, i) => i === q.step_index)
      if (!step) return
      step.anticipatedQA = step.anticipatedQA || []
      const exists = step.anticipatedQA.some(qa => qa.question === q.question)
      if (!exists) {
        step.anticipatedQA.push({ question: q.question, answer: q.answer })
      }
    })
    await supabase.from('instruction_packages').update({ steps }).eq('share_token', token)
    await invalidatePackage(token)
  }

  await recordDomainLearning(user.id, task.package.domain || 'other', qRow.question, answer.trim())

  return NextResponse.json({ ok: true })
}

export const dynamic = 'force-dynamic'
