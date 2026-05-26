import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { draftId, answers } = await req.json()

    const supabase = createSupabaseAdmin()
    const { error } = await supabase
      .from('sender_drafts')
      .update({
        interview_answers: answers,
        updated_at: new Date().toISOString(),
      })
      .eq('id', draftId)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Interview save error:', err)
    return NextResponse.json({ error: 'Failed to save answers' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const draftId = req.nextUrl.searchParams.get('draftId')
    if (!draftId) return NextResponse.json({ error: 'Missing draftId' }, { status: 400 })

    const supabase = createSupabaseAdmin()
    const { data, error } = await supabase
      .from('sender_drafts')
      .select('*')
      .eq('id', draftId)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Draft not found' }, { status: 404 })

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to get draft' }, { status: 500 })
  }
}
export const dynamic = 'force-dynamic'
