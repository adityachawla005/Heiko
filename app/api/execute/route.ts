import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { createSupabaseAdmin } from '@/lib/supabase'
import { saveSession, getSession, getCachedPackage, cachePackage } from '@/lib/redis'
import {
  classifyIntent,
  streamExecutionResponse,
  shouldAdvanceStep,
  updateSessionAfterStep,
  generateWelcomeMessage,
} from '@/lib/ai/execution'
import { ExecutionSession, InstructionPackage, ChatMessage } from '@/lib/types'
import {
  buildDomainSearchQuery,
  searchDomainLearnings,
  formatDomainLearningsForPrompt,
} from '@/lib/domain-knowledge'

export async function POST(req: NextRequest) {
  try {
    const { sessionId, message } = await req.json()

    const session = await getSession(sessionId)
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    let pkg = await getCachedPackage(session.shareToken)
    if (!pkg) {
      const supabase = createSupabaseAdmin()
      const { data: pkgRow } = await supabase
        .from('instruction_packages')
        .select('*')
        .eq('share_token', session.shareToken)
        .single()

      if (!pkgRow) {
        return NextResponse.json({ error: 'Package not found' }, { status: 404 })
      }

      pkg = {
        id: pkgRow.id,
        shareToken: pkgRow.share_token,
        title: pkgRow.title,
        description: pkgRow.description,
        domain: pkgRow.domain,
        estimatedMinutes: pkgRow.estimated_minutes,
        steps: pkgRow.steps,
        senderProfile: pkgRow.sender_profile,
        createdAt: pkgRow.created_at,
      }
      cachePackage(pkg)
    }

    const intent = await classifyIntent(message)

    let senderKnowledgeBlock: string | undefined
    if (intent === 'question' || intent === 'help' || intent === 'problem') {
      const supabaseMeta = createSupabaseAdmin()
      const { data: meta } = await supabaseMeta
        .from('instruction_packages')
        .select('sender_id, domain, title, description')
        .eq('id', pkg.id)
        .maybeSingle()

      if (meta?.sender_id) {
        const step = pkg.steps[session.currentStepIndex]
        const searchQuery = buildDomainSearchQuery({
          title: pkg.title,
          description: pkg.description,
          domain: pkg.domain,
          currentStepInstruction: step?.instruction,
          executorMessage: message,
        })
        const hits = await searchDomainLearnings(
          meta.sender_id,
          meta.domain || 'other',
          searchQuery,
          8
        )
        senderKnowledgeBlock = formatDomainLearningsForPrompt(hits)
      }
    }

    const isLastStep =
      intent === 'done' &&
      session.currentStepIndex >= pkg.steps.length - 1 &&
      session.completedSteps.length >= pkg.steps.length - 1

    const stream = await streamExecutionResponse(
      pkg,
      session,
      message,
      intent,
      senderKnowledgeBlock
    )

    const encoder = new TextEncoder()
    let fullResponse = ''

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || ''
            if (text) {
              fullResponse += text
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
            }
          }

          const advance = shouldAdvanceStep(intent)
          const userMsg: ChatMessage = {
            role: 'user',
            content: message,
            timestamp: Date.now(),
          }
          const assistantMsg: ChatMessage = {
            role: 'assistant',
            content: fullResponse,
            timestamp: Date.now(),
          }

          const updatedSession = updateSessionAfterStep(
            session,
            pkg,
            userMsg,
            assistantMsg,
            advance
          )
          await saveSession(updatedSession)

          if (intent === 'question' || intent === 'help') {
            const supabaseFb = createSupabaseAdmin()
            const shareToken = session.shareToken

            // Fire-and-forget: update last_help_question on the task row
            supabaseFb
              .from('tasks')
              .update({ last_help_question: message })
              .eq('session_id', sessionId)
              .then(() => {})

            // Log question directly  -  no self-HTTP-fetch so this can't silently fail
            ;(async () => {
              const [{ data: taskRow }, { data: pkgMeta }] = await Promise.all([
                supabaseFb.from('tasks').select('id').eq('session_id', sessionId).maybeSingle(),
                supabaseFb.from('instruction_packages').select('sender_id').eq('id', pkg.id).maybeSingle(),
              ])

              const { data: existing } = await supabaseFb
                .from('package_questions')
                .select('id, session_count')
                .eq('share_token', shareToken)
                .ilike('question', message.slice(0, 50) + '%')
                .maybeSingle()

              if (existing) {
                await supabaseFb
                  .from('package_questions')
                  .update({ session_count: (existing.session_count || 1) + 1 })
                  .eq('id', existing.id)
              } else {
                await supabaseFb.from('package_questions').insert({
                  package_id: pkg.id,
                  share_token: shareToken,
                  step_index: session.currentStepIndex,
                  question: message,
                  sender_id: pkgMeta?.sender_id ?? null,
                  task_id: taskRow?.id ?? null,
                })
              }
            })().catch(() => {})
          }

          createSupabaseAdmin().from('execution_events').insert({
            package_id: pkg.id,
            session_id: sessionId,
            event_type: intent,
            step_index: session.currentStepIndex,
          }).then(() => {})

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                done: true,
                stepIndex: updatedSession.currentStepIndex,
                totalSteps: pkg.steps.length,
                isComplete: isLastStep,
                intent,
              })}\n\n`
            )
          )
          controller.close()
        } catch (err) {
          controller.error(err)
        }
      },
    })

    return new NextResponse(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    console.error('Execute error:', err)
    return NextResponse.json({ error: 'Execution failed' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token')
    const existingSessionId = req.nextUrl.searchParams.get('sessionId')

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    if (existingSessionId) {
      const existing = await getSession(existingSessionId)
      if (existing) {
        const cached = await getCachedPackage(token)
        const stepTimings = cached?.steps.map(s => ({
          durationSeconds: s.durationSeconds,
          proactiveCheckInSeconds: s.proactiveCheckInSeconds ??
            (s.durationSeconds > 120 ? Math.floor(s.durationSeconds / 3) : null),
        })) ?? []
        return NextResponse.json({
          session: existing,
          packageTitle: cached?.title ?? token,
          stepTimings,
          totalSteps: cached?.steps.length ?? 0,
          estimatedMinutes: cached?.estimatedMinutes ?? 0,
          sessionId: existingSessionId,
          welcomeMessage: existing.conversationHistory[0]?.content ?? '',
        })
      }
    }

    let pkg = await getCachedPackage(token)
    if (!pkg) {
      const supabase = createSupabaseAdmin()
      const { data: pkgRow, error } = await supabase
        .from('instruction_packages')
        .select('*')
        .eq('share_token', token)
        .single()

      if (error || !pkgRow) {
        return NextResponse.json({ error: 'Package not found' }, { status: 404 })
      }

      pkg = {
        id: pkgRow.id,
        shareToken: pkgRow.share_token,
        title: pkgRow.title,
        description: pkgRow.description,
        domain: pkgRow.domain,
        estimatedMinutes: pkgRow.estimated_minutes,
        steps: pkgRow.steps,
        senderProfile: pkgRow.sender_profile,
        createdAt: pkgRow.created_at,
      }
      cachePackage(pkg)
    }

    const sessionId = nanoid()
    const welcomeMessage = await generateWelcomeMessage(pkg)

    const session: ExecutionSession = {
      id: sessionId,
      packageId: pkg.id,
      shareToken: token,
      currentStepIndex: 0,
      stepStartedAt: Date.now(),
      pace: 'normal',
      activeSubstitutions: [],
      conversationHistory: [
        {
          role: 'assistant',
          content: welcomeMessage,
          timestamp: Date.now(),
        },
      ],
      completedSteps: [],
      startedAt: Date.now(),
    }

    await saveSession(session)

    createSupabaseAdmin().from('execution_events').insert({
      package_id: pkg.id,
      session_id: sessionId,
      event_type: 'started',
      step_index: 0,
    }).then(() => {})

    const stepTimings = pkg.steps.map(s => ({
      durationSeconds: s.durationSeconds,
      proactiveCheckInSeconds: s.proactiveCheckInSeconds ??
        (s.durationSeconds > 120 ? Math.floor(s.durationSeconds / 3) : null),
    }))

    return NextResponse.json({
      sessionId,
      welcomeMessage,
      packageTitle: pkg.title,
      estimatedMinutes: pkg.estimatedMinutes,
      totalSteps: pkg.steps.length,
      stepTimings,
    })
  } catch (err) {
    console.error('Session init error:', err)
    return NextResponse.json({ error: 'Failed to start session' }, { status: 500 })
  }
}
export const dynamic = 'force-dynamic'
