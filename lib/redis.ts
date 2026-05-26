import Redis from 'ioredis'
import { ExecutionSession, InstructionPackage } from './types'

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
})

redis.on('error', (err) => {
  if (process.env.NODE_ENV !== 'test') {
    console.warn('Redis error:', err.message)
  }
})

const SESSION_TTL = 60 * 60 * 24 * 7
const PACKAGE_TTL = 60 * 60 * 24

export async function saveSession(session: ExecutionSession) {
  await redis.set(`session:${session.id}`, JSON.stringify(session), 'EX', SESSION_TTL)
}

export async function getSession(sessionId: string): Promise<ExecutionSession | null> {
  const raw = await redis.get(`session:${sessionId}`)
  if (!raw) return null
  return JSON.parse(raw) as ExecutionSession
}

export async function deleteSession(sessionId: string) {
  await redis.del(`session:${sessionId}`)
}

export async function cachePackage(pkg: InstructionPackage) {
  await redis.set(`pkg:${pkg.shareToken}`, JSON.stringify(pkg), 'EX', PACKAGE_TTL)
}

export async function getCachedPackage(shareToken: string): Promise<InstructionPackage | null> {
  const raw = await redis.get(`pkg:${shareToken}`)
  if (!raw) return null
  return JSON.parse(raw) as InstructionPackage
}

export async function invalidatePackage(shareToken: string) {
  await redis.del(`pkg:${shareToken}`)
}
