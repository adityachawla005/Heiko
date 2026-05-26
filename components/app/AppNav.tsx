'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Send, User, LogOut } from 'lucide-react'
import { createSupabasePublic } from '@/lib/supabase'

const links = [
  { href: '/inbox',   icon: Home, label: 'Inbox',   color: 'var(--pink)' },
  { href: '/send',    icon: Send, label: 'Send',    color: 'var(--mint)' },
  { href: '/profile', icon: User, label: 'Profile', color: 'var(--sage)' },
]

export default function AppNav() {
  const path = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await createSupabasePublic().auth.signOut()
    router.push('/login')
  }

  return (
    <aside style={{
      width: 220, flexShrink: 0, position: 'sticky', top: 0, height: '100vh',
      display: 'flex', flexDirection: 'column',
      borderRight: '1px solid var(--border)',
      background: 'var(--surface)',
      padding: '28px 16px',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40, paddingLeft: 8 }}>
        <Image src="/logo.png" alt="Heiko" width={28} height={28} style={{ borderRadius: 8 }} />
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, letterSpacing: '0.05em', color: 'var(--foreground)' }}>
          HEIKO
        </span>
      </div>

      {/* Nav links */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {links.map(({ href, icon: Icon, label, color }) => {
          const active = path === href || path.startsWith(href + '/')
          return (
            <Link key={href} href={href} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 10,
              textDecoration: 'none', transition: 'background 0.15s',
              background: active ? `color-mix(in srgb, ${color} 12%, transparent)` : 'transparent',
              color: active ? color : 'var(--muted)',
            }}>
              <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: active ? 500 : 400 }}>
                {label}
              </span>
              {active && <span style={{ marginLeft: 'auto', width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />}
            </Link>
          )
        })}
      </nav>

      {/* Bottom: logout */}
      <div style={{ marginTop: 'auto' }}>
        <button onClick={handleLogout} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 10, border: 'none',
          background: 'transparent', color: 'var(--muted)',
          cursor: 'pointer', transition: 'background 0.15s',
          fontFamily: 'var(--font-body)', fontSize: 14,
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(228,145,166,0.08)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--pink)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)' }}
        >
          <LogOut size={17} strokeWidth={1.8} />
          Log out
        </button>
      </div>
    </aside>
  )
}
