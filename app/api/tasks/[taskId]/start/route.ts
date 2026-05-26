import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { getUser } from '@/lib/auth'
import { saveSession, cachePackage } from '@/lib/redis'
import { generateWelcomeMessage } from '@/lib/ai/execution'
import { InstructionPackage, ExecutionSession } from '@/lib/types'
import { nanoid } from 'nanoid'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createSupabaseAdmin()

  const { data: task } = await supabase
    .from('tasks')
    .select('*, package:instruction_packages(*)')
    .eq('id', taskId)
    .eq('executor_id', user.id)
    .single()

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  if (task.session_id) {
    const sessionId = task.session_id

    const stepTimings = task.package.steps.map((s: { durationSeconds: number; proactiveCheckInSeconds?: number }) => ({
      durationSeconds: s.durationSeconds,
      proactiveCheckInSeconds: s.proactiveCheckInSeconds ??
        (s.durationSeconds > 120 ? Math.floor(s.durationSeconds / 3) : null),
    }))

    return NextResponse.json({
      sessionId,
      welcomeMessage: 'Welcome back! Pick up where you left off.',
      packageTitle: task.package.title,
      estimatedMinutes: task.package.estimated_minutes,
      totalSteps: task.package.steps.length,
      stepTimings,
    })
  }

  const pkg: InstructionPackage = {
    id: task.package.id,
    shareToken: task.package.share_token,
    title: task.package.title,
    description: task.package.description,
    domain: task.package.domain,
    estimatedMinutes: task.package.estimated_minutes,
    steps: task.package.steps,
    senderProfile: task.package.sender_profile,
    createdAt: task.package.created_at,
  }

  cachePackage(pkg)

  const sessionId = nanoid()
  const welcomeMessage = await generateWelcomeMessage(pkg)

  const session: ExecutionSession = {
    id: sessionId,
    packageId: pkg.id,
    shareToken: pkg.shareToken,
    currentStepIndex: 0,
    stepStartedAt: Date.now(),
    pace: 'normal',
    activeSubstitutions: [],
    conversationHistory: [{ role: 'assistant', content: welcomeMessage, timestamp: Date.now() }],
    completedSteps: [],
    startedAt: Date.now(),
  }

  await saveSession(session)

  await supabase
    .from('tasks')
    .update({ session_id: sessionId, status: 'active', started_at: new Date().toISOString() })
    .eq('id', taskId)

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
}

export const dynamic = 'force-dynamic'
