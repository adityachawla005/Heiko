import { nanoid } from 'nanoid'
import { completeJSON, complete, VISION_MODEL, SMART_MODEL } from '../groq'
import {
  PARSE_INSTRUCTIONS_PROMPT,
  NUANCE_QUESTIONS_PROMPT,
  COMPILE_PACKAGE_PROMPT,
} from './prompts'
import { InstructionPackage, NuanceQuestion, Step, Domain } from '../types'

interface ParsedDraft {
  title: string
  description: string
  domain: Domain
  estimatedMinutes: number
  steps: (Step & { gaps: string[]; domainKnowledge: string[] })[]
  senderProfile: { tone: string; personalNotes: string[] }
}

export async function parseInstructions(rawText: string): Promise<ParsedDraft> {
  const result = await completeJSON<ParsedDraft>(
    PARSE_INSTRUCTIONS_PROMPT,
    `Parse these instructions:\n\n${rawText}`
  )
  result.steps = result.steps.map((s, i) => ({
    ...s,
    id: s.id || `step_${i + 1}`,
    order: i + 1,
    nuances: s.nuances || [],
    anticipatedQA: s.anticipatedQA || [],
    substitutions: s.substitutions || [],
    checkpoints: s.checkpoints || [],
  }))
  return result
}

interface ScoredQuestion extends NuanceQuestion {
  score?: { stakes: number; specificity: number; sensory: number; executability: number; total: number }
  gap_type?: string
}

export async function generateNuanceQuestions(
  draft: ParsedDraft
): Promise<NuanceQuestion[]> {
  const result = await completeJSON<{ questions: ScoredQuestion[] }>(
    NUANCE_QUESTIONS_PROMPT,
    `Generate the 3 interview questions for this instruction set:\n\nDomain: ${draft.domain}\n\nSteps:\n${JSON.stringify(draft.steps.map(s => ({ id: s.id, order: s.order, instruction: s.instruction, gaps: s.gaps })), null, 2)}`
  )

  const questions = result.questions || []

  const seen = new Set<string>()
  return questions
    .filter(q => {
      if (seen.has(q.stepId)) return false
      if (q.score && q.score.total < 28) return false
      seen.add(q.stepId)
      return true
    })
    .sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0))
    .slice(0, 3)
    .sort((a, b) => a.stepOrder - b.stepOrder)
}

export interface CompileOptions {
  mode?: 'interview' | 'voice' | 'live'
  domainLearningsText?: string
}

export async function compilePackage(
  draft: ParsedDraft,
  interviewQA: { question: string; answer: string; stepId: string }[],
  shareToken: string,
  opts: CompileOptions = {}
): Promise<InstructionPackage> {
  const modeNote =
    opts.mode === 'live'
      ? `SEND MODE: live  -  sender will answer executor questions in real time while they work. Fill gaps aggressively from domain knowledge and step gaps; keep anticipatedQA lean but mark high-risk unknowns as on_question nuances.`
      : opts.mode === 'voice'
        ? 'SEND MODE: voice  -  nuances came from a spoken note; preserve casual tone.'
        : 'SEND MODE: interview  -  merge the 3 Q&A answers carefully into the right steps.'

  const compiled = await completeJSON<Omit<InstructionPackage, 'id' | 'shareToken' | 'createdAt'>>(
    COMPILE_PACKAGE_PROMPT,
    `Compile the final instruction package.

${modeNote}

PRIOR KNOWLEDGE (same sender, domain "${draft.domain}"  -  reuse when relevant):
${opts.domainLearningsText || '(none)'}

PARSED DRAFT:
${JSON.stringify(draft, null, 2)}

SENDER INTERVIEW ANSWERS:
${JSON.stringify(interviewQA, null, 2)}`
  )

  return {
    ...compiled,
    id: nanoid(),
    shareToken,
    createdAt: new Date().toISOString(),
    steps: (compiled.steps || draft.steps).map((s, i) => ({
      id: s.id || `step_${i + 1}`,
      order: i + 1,
      instruction: s.instruction,
      durationSeconds: s.durationSeconds || 60,
      nuances: s.nuances || [],
      anticipatedQA: s.anticipatedQA || [],
      substitutions: s.substitutions || [],
      checkpoints: s.checkpoints || [],
    })),
  }
}

export async function extractNuancesFromVoiceNote(
  transcript: string,
  draft: ParsedDraft
): Promise<{ question: string; answer: string; stepId: string }[]> {
  const result = await completeJSON<{ nuances: { stepId: string; question: string; answer: string }[] }>(
    `You are extracting cooking knowledge from a voice note a sender recorded about their recipe.
The sender spoke naturally  -  your job is to match what they said to the relevant steps and structure it.

Here are the parsed steps:
${draft.steps.map(s => `${s.id} (step ${s.order}): ${s.instruction}`).join('\n')}

From the voice note, extract every piece of practical knowledge  -  sensory cues, warnings, tips, fixes.
For each piece of knowledge, identify which step it belongs to and frame it as a question+answer pair.
Return only things the sender actually said. Do not invent.

Respond with JSON: { "nuances": [{ "stepId": "step_1", "question": "...", "answer": "..." }] }`,
    `Voice note transcript:\n\n${transcript}`
  )
  return result.nuances || []
}

export async function parseImageInstructions(base64Image: string, mimeType: string): Promise<string> {
  const groqClient = (await import('../groq')).groq
  const res = await groqClient.chat.completions.create({
    model: VISION_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64Image}` },
          },
          {
            type: 'text',
            text: 'Extract all text and instructions from this image. Preserve the structure and order. Return only the extracted text.',
          },
        ],
      },
    ],
    temperature: 0.1,
  })
  return res.choices[0].message.content ?? ''
}

export async function scrapeUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Heiko/1.0 (instruction extractor)' },
  })
  const html = await res.text()
  const text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000)

  return await complete(
    'Extract the main instructions or steps from this webpage content. Return only the relevant instruction text, preserving order.',
    text,
    SMART_MODEL
  )
}
