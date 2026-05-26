import OpenAI from 'openai'

export const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY!,
  baseURL: 'https://api.groq.com/openai/v1',
})

export const FAST_MODEL = 'llama-3.1-8b-instant'
export const SMART_MODEL = 'llama-3.3-70b-versatile'
export const VISION_MODEL = 'llama-3.2-11b-vision-preview'

export async function streamCompletion(
  systemPrompt: string,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  model = SMART_MODEL
) {
  return groq.chat.completions.create({
    model,
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
    stream: true,
    temperature: 0.3,
  })
}

export async function complete(
  systemPrompt: string,
  userMessage: string,
  model = SMART_MODEL
): Promise<string> {
  const res = await groq.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.3,
  })
  return res.choices[0].message.content ?? ''
}

export async function completeJSON<T>(
  systemPrompt: string,
  userMessage: string,
  model = SMART_MODEL
): Promise<T> {
  const res = await groq.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' },
  })
  const text = res.choices[0].message.content ?? '{}'
  return JSON.parse(text) as T
}
