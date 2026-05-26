import { createSupabaseAdmin } from '@/lib/supabase'
import {
  buildLearningSearchText,
  cosineSimilarity,
  embedText,
  embedTexts,
  embeddingsEnabled,
  parseStoredEmbedding,
} from '@/lib/embeddings'
import type { Domain } from '@/lib/types'

export interface DomainLearning {
  question: string
  answer: string
  times_applied?: number
  similarity?: number
}

type LearningRow = DomainLearning & {
  id?: string
  embedding?: unknown
}

export function buildDomainSearchQuery(parts: {
  title?: string
  description?: string
  rawInput?: string
  domain?: string
  steps?: Array<{
    instruction?: string
    gaps?: string[]
    domainKnowledge?: string[]
  }>
  executorMessage?: string
  currentStepInstruction?: string
}): string {
  const chunks: string[] = []
  if (parts.domain) chunks.push(`Domain: ${parts.domain}`)
  if (parts.title) chunks.push(parts.title)
  if (parts.description) chunks.push(parts.description)
  if (parts.rawInput) chunks.push(parts.rawInput)
  if (parts.currentStepInstruction) chunks.push(`Current step: ${parts.currentStepInstruction}`)
  if (parts.executorMessage) chunks.push(`Executor asks: ${parts.executorMessage}`)
  for (const s of parts.steps || []) {
    if (s.instruction) chunks.push(s.instruction)
    for (const g of s.gaps || []) chunks.push(g)
    for (const d of s.domainKnowledge || []) chunks.push(d)
  }
  return chunks.filter(Boolean).join('\n').slice(0, 12000)
}

export async function getDomainLearnings(
  senderId: string,
  domain: Domain | string,
  limit = 24
): Promise<DomainLearning[]> {
  const supabase = createSupabaseAdmin()
  const { data } = await supabase
    .from('domain_learnings')
    .select('question, answer, times_applied')
    .eq('sender_id', senderId)
    .eq('domain', domain)
    .order('times_applied', { ascending: false })
    .limit(limit)

  return data || []
}

async function persistLearningEmbedding(
  id: string,
  searchText: string,
  vector: number[]
): Promise<void> {
  const supabase = createSupabaseAdmin()
  const { error } = await supabase
    .from('domain_learnings')
    .update({
      search_text: searchText,
      embedding: vector,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.warn('domain_learnings embedding update failed:', error.message)
  }
}

async function backfillMissingEmbeddings(
  senderId: string,
  domain: Domain | string,
  max = 20
): Promise<void> {
  if (!embeddingsEnabled()) return

  const supabase = createSupabaseAdmin()
  const { data: rows } = await supabase
    .from('domain_learnings')
    .select('id, question, answer, search_text')
    .eq('sender_id', senderId)
    .eq('domain', domain)
    .is('embedding', null)
    .order('times_applied', { ascending: false })
    .limit(max)

  if (!rows?.length) return

  const texts = rows.map((r) =>
    r.search_text || buildLearningSearchText(r.question, r.answer)
  )
  const vectors = await embedTexts(texts)

  await Promise.all(
    rows.map(async (row, i) => {
      const vec = vectors[i]
      if (!vec) return
      const searchText =
        row.search_text || buildLearningSearchText(row.question, row.answer)
      await persistLearningEmbedding(row.id, searchText, vec)
    })
  )
}

function mergeLearnings(
  semantic: DomainLearning[],
  popular: DomainLearning[],
  limit: number
): DomainLearning[] {
  const seen = new Set<string>()
  const out: DomainLearning[] = []

  for (const l of [...semantic, ...popular]) {
    const key = `${l.question}::${l.answer}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(l)
    if (out.length >= limit) break
  }
  return out
}

async function searchViaJsonEmbeddings(
  senderId: string,
  domain: string,
  queryEmbedding: number[],
  limit: number
): Promise<DomainLearning[]> {
  const supabase = createSupabaseAdmin()
  const { data: rows } = await supabase
    .from('domain_learnings')
    .select('question, answer, times_applied, embedding')
    .eq('sender_id', senderId)
    .eq('domain', domain)
    .not('embedding', 'is', null)
    .limit(400)

  if (!rows?.length) return []

  const scored: DomainLearning[] = []
  for (const row of rows as LearningRow[]) {
    const vec = parseStoredEmbedding(row.embedding)
    if (!vec) continue
    scored.push({
      question: row.question,
      answer: row.answer,
      times_applied: row.times_applied,
      similarity: cosineSimilarity(queryEmbedding, vec),
    })
  }
  scored.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
  return scored.slice(0, limit)
}

export async function searchDomainLearnings(
  senderId: string,
  domain: Domain | string,
  queryText: string,
  limit = 16
): Promise<DomainLearning[]> {
  if (!embeddingsEnabled() || !queryText.trim()) {
    return getDomainLearnings(senderId, domain, limit)
  }

  await backfillMissingEmbeddings(senderId, domain)

  const queryEmbedding = await embedText(queryText.trim())
  if (!queryEmbedding) {
    return getDomainLearnings(senderId, domain, limit)
  }

  const semanticLimit = Math.max(limit - 4, 8)
  const pgHits = await searchViaJsonEmbeddings(
    senderId,
    domain,
    queryEmbedding,
    semanticLimit
  )

  const popular = await getDomainLearnings(senderId, domain, 6)
  return mergeLearnings(pgHits, popular, limit)
}

export async function recordDomainLearning(
  senderId: string,
  domain: Domain | string,
  question: string,
  answer: string
): Promise<void> {
  const supabase = createSupabaseAdmin()
  const q = question.trim()
  const a = answer.trim()
  if (!q || !a) return

  const searchText = buildLearningSearchText(q, a)
  const vector = embeddingsEnabled() ? await embedText(searchText) : null

  const { data: existing } = await supabase
    .from('domain_learnings')
    .select('id, times_applied')
    .eq('sender_id', senderId)
    .eq('domain', domain)
    .ilike('question', q.slice(0, 80) + '%')
    .maybeSingle()

  const now = new Date().toISOString()
  const basePayload = vector
    ? { search_text: searchText, embedding: vector }
    : { search_text: searchText }

  const payloadWithEmbed = vector ? { ...basePayload, embedding: vector } : basePayload

  async function saveRow(id: string | null, isInsert: boolean) {
    const payload = {
      ...(isInsert
        ? { sender_id: senderId, domain, question: q, answer: a, times_applied: 1 }
        : { answer: a, times_applied: (existing?.times_applied || 1) + 1 }),
      updated_at: now,
      ...payloadWithEmbed,
    }

    if (isInsert) {
      const { data: inserted, error } = await supabase
        .from('domain_learnings')
        .insert(payload as Record<string, unknown>)
        .select('id')
        .single()

      if (error?.message.includes('duplicate key')) {
        await recordDomainLearning(senderId, domain, q, a)
        return
      }
      if (inserted?.id && vector) await persistLearningEmbedding(inserted.id, searchText, vector)
      return
    }

    await supabase
      .from('domain_learnings')
      .update(payload as Record<string, unknown>)
      .eq('id', id!)
  }

  if (existing) {
    await saveRow(existing.id, false)
  } else {
    await saveRow(null, true)
  }
}

export function formatDomainLearningsForPrompt(learnings: DomainLearning[]): string {
  if (!learnings.length) return '(none yet  -  first package in this domain)'
  return learnings
    .map((l, i) => {
      const score =
        l.similarity != null ? ` [relevance ${(l.similarity * 100).toFixed(0)}%]` : ''
      return `${i + 1}. Q: ${l.question}\n   A: ${l.answer}${score}`
    })
    .join('\n')
}
