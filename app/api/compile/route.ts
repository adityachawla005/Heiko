import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { compilePackage } from '@/lib/ai/pipeline'
import { createSupabaseAdmin } from '@/lib/supabase'
import { cachePackage } from '@/lib/redis'
import { getUser } from '@/lib/auth'
import {
  buildDomainSearchQuery,
  searchDomainLearnings,
  formatDomainLearningsForPrompt,
  recordDomainLearning,
} from '@/lib/domain-knowledge'
import type { SendMode } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    const { draftId, mode = 'interview' } = await req.json() as { draftId: string; mode?: SendMode }
    const user = await getUser()

    const supabase = createSupabaseAdmin()

    const { data: draft, error } = await supabase
      .from('sender_drafts')
      .select('*')
      .eq('id', draftId)
      .single()

    if (error || !draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    }

    await supabase
      .from('sender_drafts')
      .update({ status: 'compiling', updated_at: new Date().toISOString() })
      .eq('id', draftId)

    const shareToken = nanoid(10)
    const parsed = draft.parsed_draft
    const domain = parsed?.domain || 'other'

    const searchQuery = buildDomainSearchQuery({
      title: parsed?.title,
      description: parsed?.description,
      rawInput: draft.raw_input,
      domain,
      steps: parsed?.steps,
    })

    const learnings = user
      ? await searchDomainLearnings(user.id, domain, searchQuery)
      : []
    const domainLearningsText = formatDomainLearningsForPrompt(learnings)

    const pkg = await compilePackage(
      parsed,
      draft.interview_answers || [],
      shareToken,
      { mode, domainLearningsText }
    )

    const { error: insertError } = await supabase.from('instruction_packages').insert({
      id: pkg.id,
      share_token: shareToken,
      title: pkg.title,
      description: pkg.description,
      domain: pkg.domain,
      estimated_minutes: pkg.estimatedMinutes,
      steps: pkg.steps,
      sender_profile: pkg.senderProfile,
      raw_input: draft.raw_input,
      sender_id: user?.id ?? null,
      send_mode: mode,
    })

    if (insertError) throw insertError

    await supabase
      .from('sender_drafts')
      .update({
        status: 'done',
        package_id: pkg.id,
        send_mode: mode,
        updated_at: new Date().toISOString(),
      })
      .eq('id', draftId)

    cachePackage(pkg)

    if (user && draft.interview_answers?.length) {
      for (const qa of draft.interview_answers as { question: string; answer: string }[]) {
        if (qa.question && qa.answer?.trim()) {
          await recordDomainLearning(user.id, domain, qa.question, qa.answer)
        }
      }
    }

    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/run/${shareToken}`

    return NextResponse.json({ shareToken, shareUrl, packageId: pkg.id, package: pkg })
  } catch (err) {
    console.error('Compile error:', err)
    return NextResponse.json({ error: 'Failed to compile package' }, { status: 500 })
  }
}
export const dynamic = 'force-dynamic'
