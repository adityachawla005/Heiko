import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { parseInstructions, parseImageInstructions, scrapeUrl } from '@/lib/ai/pipeline'
import { generateNuanceQuestions } from '@/lib/ai/pipeline'
import { createSupabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const type = formData.get('type') as string

    let rawText = ''

    if (type === 'text') {
      rawText = formData.get('text') as string
    } else if (type === 'url') {
      const url = formData.get('url') as string
      rawText = await scrapeUrl(url)
    } else if (type === 'image') {
      const file = formData.get('file') as File
      const buffer = await file.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      rawText = await parseImageInstructions(base64, file.type)
    } else if (type === 'pdf') {
      const file = formData.get('file') as File
      const buffer = await file.arrayBuffer()
      const { PDFParse } = await import('pdf-parse')
      const parser = new PDFParse({ data: Buffer.from(buffer) })
      const data = await parser.getText()
      rawText = data.text
    } else if (type === 'voice') {
      const file = formData.get('file') as File
      const groqClient = (await import('@/lib/groq')).groq
      const transcription = await groqClient.audio.transcriptions.create({
        file: file,
        model: 'whisper-large-v3',
      })
      rawText = transcription.text
    }

    if (!rawText?.trim()) {
      return NextResponse.json({ error: 'No content extracted' }, { status: 400 })
    }

    const draft = await parseInstructions(rawText)
    const nuanceQuestions = await generateNuanceQuestions(draft)

    const draftId = nanoid()
    const supabase = createSupabaseAdmin()
    await supabase.from('sender_drafts').insert({
      id: draftId,
      raw_input: rawText,
      parsed_draft: draft,
      nuance_questions: nuanceQuestions,
      status: 'interviewing',
    })

    return NextResponse.json({
      draftId,
      draft,
      questions: nuanceQuestions,
    })
  } catch (err) {
    console.error('Parse error:', err)
    return NextResponse.json({ error: 'Failed to parse instructions' }, { status: 500 })
  }
}
export const dynamic = 'force-dynamic'
