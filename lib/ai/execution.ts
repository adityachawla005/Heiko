import { groq, FAST_MODEL, SMART_MODEL, streamCompletion } from '../groq'
import { buildExecutionSystemPrompt, CLASSIFY_INTENT_PROMPT } from './prompts'
import { InstructionPackage, ExecutionSession, ExecutorIntent, ChatMessage } from '../types'

export async function classifyIntent(message: string): Promise<ExecutorIntent> {
  const result = await groq.chat.completions.create({
    model: FAST_MODEL,
    messages: [
      { role: 'system', content: CLASSIFY_INTENT_PROMPT },
      { role: 'user', content: message },
    ],
    temperature: 0,
    response_format: { type: 'json_object' },
  })
  try {
    const parsed = JSON.parse(result.choices[0].message.content ?? '{}')
    return (parsed.intent as ExecutorIntent) || 'unknown'
  } catch {
    return 'unknown'
  }
}

export function buildExecutionMessages(
  session: ExecutionSession,
  pkg: InstructionPackage,
  newMessage: string
) {
  const currentStep = pkg.steps[session.currentStepIndex]
  const elapsed = Math.floor((Date.now() - session.stepStartedAt) / 1000)

  const contextMessage = `CURRENT STATE:
- Step ${session.currentStepIndex + 1} of ${pkg.steps.length}: "${currentStep?.instruction}"
- Elapsed on this step: ${elapsed}s (expected: ${currentStep?.durationSeconds}s)
- Active substitutions: ${session.activeSubstitutions.join(', ') || 'none'}
- Overall progress: ${session.completedSteps.length}/${pkg.steps.length} steps done

EXECUTOR MESSAGE: ${newMessage}`

  const history: { role: 'user' | 'assistant'; content: string }[] = session.conversationHistory
    .slice(-6)
    .map(m => ({ role: m.role, content: m.content }))

  return [...history, { role: 'user' as const, content: contextMessage }]
}

export function getSystemPrompt(
  pkg: InstructionPackage,
  senderKnowledgeBlock?: string
): string {
  const base = buildExecutionSystemPrompt(pkg)
  if (!senderKnowledgeBlock?.trim()) return base
  return `${base}

## Sender's prior answers (same domain  -  use when relevant)
${senderKnowledgeBlock}`
}

export async function generateWelcomeMessage(pkg: InstructionPackage): Promise<string> {
  const firstStep = pkg.steps[0]
  const senderWord = pkg.domain === 'cooking' ? 'They' : 'They'

  return `Hey! ${pkg.senderProfile.personalNotes[0] ? `"${pkg.senderProfile.personalNotes[0]}"` : `I've got the full guide for **${pkg.title}** ready for you.`}

This will take about **${pkg.estimatedMinutes} minutes**. I'll walk with you the whole time  -  one step at a time.

When you're ready, here's where we start:

**Step 1:** ${firstStep.instruction}

${firstStep.nuances.filter(n => n.surfaceWhen === 'always').map(n => `> ${n.content}`).join('\n')}

Reply **done** when you're ready to begin, or ask me anything first.`
}

export async function streamExecutionResponse(
  pkg: InstructionPackage,
  session: ExecutionSession,
  userMessage: string,
  intent: ExecutorIntent,
  senderKnowledgeBlock?: string
) {
  const systemPrompt = getSystemPrompt(pkg, senderKnowledgeBlock)
  const messages = buildExecutionMessages(session, pkg, userMessage)

  const intentHint = intent !== 'unknown'
    ? `[Intent classified as: ${intent}]\n\n`
    : ''

  const lastMsg = messages[messages.length - 1]
  lastMsg.content = intentHint + lastMsg.content

  return streamCompletion(systemPrompt, messages, SMART_MODEL)
}

export function shouldAdvanceStep(intent: ExecutorIntent): boolean {
  return intent === 'done'
}

export function updateSessionAfterStep(
  session: ExecutionSession,
  pkg: InstructionPackage,
  newMessage: ChatMessage,
  assistantMessage: ChatMessage,
  advance: boolean
): ExecutionSession {
  const updated = { ...session }
  updated.conversationHistory = [
    ...session.conversationHistory,
    newMessage,
    assistantMessage,
  ].slice(-20)

  if (advance && session.currentStepIndex < pkg.steps.length - 1) {
    updated.completedSteps = [...session.completedSteps, session.currentStepIndex]
    updated.currentStepIndex = session.currentStepIndex + 1
    updated.stepStartedAt = Date.now()
  }

  const currentStep = pkg.steps[session.currentStepIndex]
  if (advance && currentStep) {
    const elapsed = (Date.now() - session.stepStartedAt) / 1000
    const ratio = elapsed / currentStep.durationSeconds
    if (ratio < 0.7) updated.pace = 'fast'
    else if (ratio > 1.5) updated.pace = 'slow'
    else updated.pace = 'normal'
  }

  return updated
}
