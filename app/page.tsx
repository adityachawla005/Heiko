import Link from 'next/link'
import Image from 'next/image'
import LottieBackground from '@/components/LottieBackground'

const P = { pink: '#E491A6', mauve: '#845763', mint: '#92E4BA', sage: '#90C67F' }

const FOOTER_STEPS = [
  { label: 'Capture', color: P.pink },
  { label: 'Structure', color: P.mauve },
  { label: 'Guide', color: P.mint },
  { label: 'Track', color: P.sage },
] as const

export default function LandingPage() {
  return (
    <main style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflowX: 'hidden' }}>

      {/* Lottie background */}
      <LottieBackground />

      {/* Header */}
      <header style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '28px 36px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Image src="/logo.png" alt="Heiko" width={32} height={32} style={{ borderRadius: 9 }} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, letterSpacing: '0.05em', color: 'var(--foreground)' }}>HEIKO</span>
        </div>
        <Link href="/login" style={{
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          padding: '10px 22px', borderRadius: 10, textDecoration: 'none',
          background: `linear-gradient(135deg, ${P.pink}, ${P.mauve})`,
          color: '#fff', boxShadow: `0 0 28px rgba(228,145,166,0.25)`,
        }}>
          Sign in
        </Link>
      </header>

      {/* Hero */}
      <div style={{ position: 'relative', zIndex: 10, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 36px 80px', textAlign: 'center' }}>

        {/* Four-colour dot row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28, alignItems: 'center' }}>
          {[P.pink, P.mauve, P.mint, P.sage].map(c => (
            <span key={c} style={{ width: 7, height: 7, borderRadius: '50%', background: c, opacity: 0.8 }} />
          ))}
        </div>

        <h1 style={{
          fontFamily: 'var(--font-display)', fontWeight: 800,
          fontSize: 'clamp(3.4rem, 11vw, 6rem)',
          lineHeight: 0.93, letterSpacing: '-0.04em',
          color: 'var(--foreground)', marginBottom: '1.6rem',
        }}>
          KNOW-HOW,<br />
          <span style={{ background: `linear-gradient(120deg, ${P.pink} 0%, ${P.mauve} 60%, ${P.mint} 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            DELIVERED.
          </span>
        </h1>

        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 15, color: 'var(--foreground)', marginBottom: '2.8rem', opacity: 0.6, lineHeight: 1.5 }}>
          Share what you know. We turn it into steps<br />anyone can follow  -  live, on the job.
        </p>

        <Link href="/login" style={{
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          padding: '15px 40px', borderRadius: 14,
          background: `linear-gradient(135deg, ${P.pink}, ${P.mauve})`,
          color: '#fff', textDecoration: 'none',
          boxShadow: `0 0 60px rgba(228,145,166,0.22)`,
        }}>
          Get started
        </Link>
      </div>

      {/* Footer */}
      <footer className="landing-footer" style={{ position: 'relative', zIndex: 10, flexShrink: 0, marginTop: 'auto' }}>
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <Image src="/logo.png" alt="Heiko" width={22} height={22} style={{ borderRadius: 6 }} />
            <span>HEIKO</span>
          </div>

          <nav className="landing-footer-pipeline" aria-label="How Heiko works">
            {FOOTER_STEPS.map(({ label, color }) => (
              <span key={label} className="landing-footer-word" style={{ color }}>
                {label}
              </span>
            ))}
          </nav>

          <span className="landing-footer-copy">© 2026</span>
        </div>
      </footer>
    </main>
  )
}
