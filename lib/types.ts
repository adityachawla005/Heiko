export type SendMode = 'interview' | 'voice' | 'live'

export type Domain =
  | 'cooking'
  | 'technical'
  | 'medical'
  | 'assembly'
  | 'admin'
  | 'education'
  | 'other'

export interface Nuance {
  type: 'tip' | 'warning' | 'personal' | 'checkpoint'
  content: string
  surfaceWhen: 'always' | 'on_question' | 'on_problem' | 'proactive'
  source: 'sender' | 'domain'
}

export interface QA {
  question: string
  answer: string
}

export interface Substitution {
  missing: string
  replacement: string
  impact: string
  senderApproved: boolean
}

export interface Checkpoint {
  timing: 'before' | 'during' | 'after'
  signal: string
  ifNot: string
}

export interface Step {
  id: string
  order: number
  instruction: string
  durationSeconds: number
  proactiveCheckInSeconds?: number
  nuances: Nuance[]
  anticipatedQA: QA[]
  substitutions: Substitution[]
  checkpoints: Checkpoint[]
}

export interface InstructionPackage {
  id: string
  shareToken: string
  title: string
  description: string
  domain: Domain
  estimatedMinutes: number
  steps: Step[]
  senderProfile: {
    tone: string
    personalNotes: string[]
  }
  createdAt: string
}

export interface NuanceQuestion {
  stepId: string
  stepOrder: number
  question: string
  context: string
}

export interface ExecutionSession {
  id: string
  packageId: string
  shareToken: string
  currentStepIndex: number
  stepStartedAt: number
  pace: 'slow' | 'normal' | 'fast'
  activeSubstitutions: string[]
  conversationHistory: ChatMessage[]
  completedSteps: number[]
  startedAt: number
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export type ExecutorIntent =
  | 'done'
  | 'help'
  | 'problem'
  | 'substitute'
  | 'question'
  | 'unknown'
