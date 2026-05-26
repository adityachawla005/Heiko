'use client'

import { createSupabasePublic } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

export default function LogoutButton() {
  const router = useRouter()
  const handleLogout = async () => {
    await createSupabasePublic().auth.signOut()
    router.push('/login')
  }
  return (
    <button onClick={handleLogout} style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '12px 20px', borderRadius: 12, cursor: 'pointer',
      background: 'none', border: '1px solid var(--border)',
      fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--muted)',
      transition: 'border-color 0.15s, color 0.15s',
    }}
    onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = 'rgba(228,145,166,0.3)'; el.style.color = 'var(--pink)' }}
    onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = 'var(--border)'; el.style.color = 'var(--muted)' }}
    >
      <LogOut size={15} /> Sign out
    </button>
  )
}
