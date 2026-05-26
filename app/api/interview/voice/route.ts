import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { groq } from '@/lib/groq'
import { extractNuancesFromVoiceNote } from '@/lib/ai/pipeline'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const draftId = formData.get('draftId') as string

    if (!file || !draftId) {
      return NextResponse.json({ error: 'Missing file or draftId' }, { status: 400 })
    }

    const transcription = await groq.audio.transcriptions.create({
      file,
      model: 'whisper-large-v3',
    })

    const supabase = createSupabaseAdmin()
    const { data: draft } = await supabase
      .from('sender_drafts')
      .select('parsed_draft')
      .eq('id', draftId)
      .single()

    if (!draft?.parsed_draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    }

    const nuances = await extractNuancesFromVoiceNote(
      transcription.text,
      draft.parsed_draft
    )

    await supabase
      .from('sender_drafts')
      .update({
        interview_answers: nuances,
        updated_at: new Date().toISOString(),
      })
      .eq('id', draftId)

    return NextResponse.json({ ok: true, nuances })
  } catch (err) {
    console.error('Voice interview error:', err)
    return NextResponse.json({ error: 'Failed to process voice note' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
