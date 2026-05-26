import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { invalidatePackage } from '@/lib/redis'
import { recordDomainLearning } from '@/lib/domain-knowledge'
import type { Step } from '@/lib/types'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const supabase = createSupabaseAdmin()

  const [{ data: pkg }, { data: questions }] = await Promise.all([
    supabase
      .from('instruction_packages')
      .select('title, estimated_minutes')
      .eq('share_token', token)
      .single(),
    supabase
      .from('package_questions')
      .select('*')
      .eq('share_token', token)
      .order('session_count', { ascending: false })
      .order('created_at', { ascending: true }),
  ])

  if (!pkg) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ pkg, questions: questions || [] })
}

export async function POST(req: NextRequest) {
  const { token, answers } = await req.json()

  if (!token || !answers?.length) {
    return NextResponse.json({ error: 'Missing data' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin()
  const now = new Date().toISOString()

  await Promise.all(
    answers.map(({ id, answer }: { id: string; answer: string }) =>
      supabase
        .from('package_questions')
        .update({ answer, answered_at: now })
        .eq('id', id)
        .eq('share_token', token)
    )
  )

  const { data: answered } = await supabase
    .from('package_questions')
    .select('*')
    .eq('share_token', token)
    .not('answer', 'is', null)

  const { data: pkgMeta } = await supabase
    .from('instruction_packages')
    .select('steps, domain, sender_id')
    .eq('share_token', token)
    .single()

  if (answered?.length) {
    const pkgRow = pkgMeta

    if (pkgRow) {
      const steps = pkgRow.steps as Step[]
      answered.forEach(q => {
        const step = steps.find((_, i) => i === q.step_index)
        if (!step) return
        step.anticipatedQA = step.anticipatedQA || []
        const exists = step.anticipatedQA.some(qa => qa.question === q.question)
        if (!exists) {
          step.anticipatedQA.push({ question: q.question, answer: q.answer })
        }
      })

      await supabase
        .from('instruction_packages')
        .update({ steps })
        .eq('share_token', token)

      await invalidatePackage(token)
    }
  }

  if (pkgMeta?.sender_id) {
    for (const { id, answer: ans } of answers as { id: string; answer: string }[]) {
      const { data: row } = await supabase
        .from('package_questions')
        .select('question')
        .eq('id', id)
        .single()
      if (row?.question && ans) {
        await recordDomainLearning(pkgMeta.sender_id, pkgMeta.domain || 'other', row.question, ans)
      }
    }
  }

  return NextResponse.json({ ok: true, answered: answers.length })
}

export async function PATCH(req: NextRequest) {
  const { token, packageId, stepIndex, question, taskId } = await req.json()
  if (!token || !question) return NextResponse.json({ ok: false })

  const supabase = createSupabaseAdmin()

  const { data: pkg } = await supabase
    .from('instruction_packages')
    .select('sender_id')
    .eq('share_token', token)
    .single()

  let resolvedTaskId = taskId as string | undefined
  if (!resolvedTaskId) {
    const { data: taskRow } = await supabase
      .from('tasks')
      .select('id')
      .eq('package_id', packageId)
      .not('session_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    resolvedTaskId = taskRow?.id
  }

  const { data: existing } = await supabase
    .from('package_questions')
    .select('id, session_count')
    .eq('share_token', token)
    .ilike('question', question.slice(0, 50) + '%')
    .maybeSingle()

  if (existing) {
    await supabase
      .from('package_questions')
      .update({ session_count: (existing.session_count || 1) + 1 })
      .eq('id', existing.id)
  } else {
    await supabase.from('package_questions').insert({
      package_id: packageId,
      share_token: token,
      step_index: stepIndex,
      question,
      sender_id: pkg?.sender_id ?? null,
      task_id: resolvedTaskId ?? null,
    })
  }

  return NextResponse.json({ ok: true })
}

export const dynamic = 'force-dynamic'
