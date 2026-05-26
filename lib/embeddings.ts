export const EMBEDDING_DIM = 384
const DEFAULT_LOCAL_MODEL = 'Xenova/all-MiniLM-L6-v2'
const MAX_CHARS = 2000

type FeatureExtractionPipeline = Awaited<
  ReturnType<typeof import('@xenova/transformers')['pipeline']>
>

let localPipeline: Promise<FeatureExtractionPipeline> | null = null

function provider(): 'ollama' | 'local' {
  const p = (process.env.EMBEDDING_PROVIDER || 'local').toLowerCase()
  return p === 'ollama' ? 'ollama' : 'local'
}

export function embeddingsEnabled(): boolean {
  return process.env.DISABLE_EMBEDDINGS !== 'true'
}

export function buildLearningSearchText(question: string, answer: string): string {
  return `Question: ${question.trim()}\nAnswer: ${answer.trim()}`
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom > 0 ? dot / denom : 0
}

function tensorToVector(output: { data: Float32Array | number[] }): number[] {
  const data = output.data
  return Array.from(data instanceof Float32Array ? data : new Float32Array(data))
}

async function getLocalPipeline(): Promise<FeatureExtractionPipeline> {
  if (!localPipeline) {
    localPipeline = (async () => {
      const { env, pipeline } = await import('@xenova/transformers')
      env.allowLocalModels = true
      env.useBrowserCache = false
      if (process.env.TRANSFORMERS_CACHE) {
        env.cacheDir = process.env.TRANSFORMERS_CACHE
      }
      const modelId = process.env.EMBEDDING_MODEL || DEFAULT_LOCAL_MODEL
      console.info(`[embeddings] Loading local model ${modelId} (first run downloads ~25MB)…`)
      return pipeline('feature-extraction', modelId)
    })()
  }
  return localPipeline
}

async function embedWithLocal(text: string): Promise<number[]> {
  const pipe = await getLocalPipeline()
  const out = await (pipe as (text: string, opts: object) => Promise<{ data: Float32Array }>)(
    text.slice(0, MAX_CHARS),
    {
      pooling: 'mean',
      normalize: true,
    }
  )
  return tensorToVector(out)
}

async function embedWithOllama(text: string): Promise<number[] | null> {
  const base = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '')
  const model = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text'
  try {
    const res = await fetch(`${base}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: text.slice(0, MAX_CHARS) }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) {
      console.warn('[embeddings] Ollama error:', await res.text())
      return null
    }
    const data = (await res.json()) as { embedding?: number[] }
    return data.embedding?.length ? data.embedding : null
  } catch (err) {
    console.warn('[embeddings] Ollama unreachable, falling back to local model:', err)
    return null
  }
}

async function embedOne(text: string): Promise<number[] | null> {
  const trimmed = text.trim()
  if (!trimmed || !embeddingsEnabled()) return null

  if (provider() === 'ollama') {
    const ollamaVec = await embedWithOllama(trimmed)
    if (ollamaVec) return ollamaVec
  }

  try {
    return await embedWithLocal(trimmed)
  } catch (err) {
    console.error('[embeddings] Local model failed:', err)
    return null
  }
}

export async function embedText(text: string): Promise<number[] | null> {
  return embedOne(text)
}

export async function embedTexts(texts: string[]): Promise<(number[] | null)[]> {
  if (!embeddingsEnabled()) return texts.map(() => null)
  return Promise.all(texts.map((t) => (t.trim() ? embedOne(t) : Promise.resolve(null))))
}

export function parseStoredEmbedding(raw: unknown): number[] | null {
  if (!raw) return null
  if (Array.isArray(raw) && typeof raw[0] === 'number') {
    const vec = raw as number[]
    if (vec.length !== EMBEDDING_DIM) return null
    return vec
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed) && typeof parsed[0] === 'number') {
        const vec = parsed as number[]
        if (vec.length !== EMBEDDING_DIM) return null
        return vec
      }
    } catch {
      return null
    }
  }
  return null
}
