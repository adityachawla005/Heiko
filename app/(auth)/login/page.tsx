'use client'

import { useState } from 'react'
import { createSupabasePublic } from '@/lib/supabase'
import { Loader2, ArrowRight, Mail } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import LottieBackground from '@/components/LottieBackground'

const P = { pink: '#E491A6', mauve: '#845763', mint: '#92E4BA', sage: '#90C67F' }

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')

    const supabase = createSupabasePublic()
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/inbox` },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
    } else {
      setSent(true)
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <LottieBackground />

      <header className="auth-header">
        <Link href="/" className="auth-header-brand">
          <Image src="/logo.png" alt="Heiko" width={32} height={32} style={{ borderRadius: 9 }} />
          <span>HEIKO</span>
        </Link>
        <Link href="/" className="auth-header-back">
          ← Home
        </Link>
      </header>

      <div className="auth-main">
        <div className="auth-card">
          <div className="auth-card-head">
            <div className="auth-dots" aria-hidden>
              {[P.pink, P.mauve, P.mint, P.sage].map(c => (
                <span key={c} style={{ background: c }} />
              ))}
            </div>
            <h1 className="auth-title">Sign in</h1>
            <p className="auth-subtitle">
              Someone wrote it. You have to do it.
            </p>
          </div>

          {sent ? (
            <div className="auth-sent">
              <div className="auth-sent-icon">
                <Mail size={22} strokeWidth={1.75} />
              </div>
              <p className="auth-sent-title">Check your email</p>
              <p className="auth-sent-text">
                We sent a magic link to{' '}
                <strong style={{ color: P.pink }}>{email}</strong>.
                Tap it to sign in.
              </p>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="auth-form">
              <label htmlFor="email" className="auth-label">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="auth-input"
                autoFocus
                autoComplete="email"
              />
              {error && <p className="auth-error">{error}</p>}
              <button
                type="submit"
                disabled={!email.trim() || loading}
                className="auth-submit"
                style={{
                  background: `linear-gradient(135deg, ${P.pink}, ${P.mauve})`,
                  boxShadow: `0 0 40px rgba(228,145,166,0.2)`,
                }}
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    <span>Continue</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
