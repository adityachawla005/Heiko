import { requireUser, getProfile } from '@/lib/auth'
import { createSupabaseAdmin } from '@/lib/supabase'
import LogoutButton from './LogoutButton'
import Image from 'next/image'

export default async function ProfilePage() {
  const user = await requireUser()
  const profile = await getProfile(user.id)
  const supabase = createSupabaseAdmin()

  const [{ count: sent }, { count: received }] = await Promise.all([
    supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('sender_id', user.id),
    supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('executor_id', user.id),
  ])

  return (
    <div style={{ padding: '48px 56px', maxWidth: 640 }}>

      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 32, letterSpacing: '-0.03em', color: 'var(--foreground)', marginBottom: 40 }}>
        Profile
      </h1>

      {/* Identity card */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '28px 32px', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 20 }}>
        <div style={{ width: 60, height: 60, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-display)', background: 'linear-gradient(135deg, var(--pink), var(--mauve))', color: '#fff' }}>
          {profile?.name?.[0]?.toUpperCase() || '?'}
        </div>
        <div>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--foreground)', marginBottom: 4 }}>{profile?.name}</p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--muted)' }}>{user.email}</p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {[
          { value: sent ?? 0, label: 'Tasks sent', color: 'var(--pink)' },
          { value: received ?? 0, label: 'Tasks received', color: 'var(--mint)' },
        ].map(({ value, label, color }) => (
          <div key={label} style={{ padding: '28px 32px', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)', textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 40, color, letterSpacing: '-0.04em', lineHeight: 1 }}>{value}</p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* About */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 28 }}>
        <Image src="/logo.png" alt="Heiko" width={36} height={36} style={{ borderRadius: 10, flexShrink: 0 }} />
        <div>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: 'var(--foreground)', marginBottom: 2 }}>Heiko</p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--muted)' }}>Know-how, delivered.</p>
        </div>
      </div>

      <LogoutButton />
    </div>
  )
}
