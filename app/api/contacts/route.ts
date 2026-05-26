import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { getUser } from '@/lib/auth'

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createSupabaseAdmin()
  const { data } = await supabase
    .from('contacts')
    .select('*, contact:profiles!contacts_contact_id_fkey(id, name, avatar_url)')
    .eq('user_id', user.id)
    .order('task_count', { ascending: false })

  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { email, nickname } = await req.json()
  const supabase = createSupabaseAdmin()

  const { data: { users } } = await supabase.auth.admin.listUsers()
  const match = users.find(u => u.email === email)
  if (!match) return NextResponse.json({ error: 'No Heiko account found for that email' }, { status: 404 })

  const { data: found } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('id', match.id)
    .single()

  if (!found) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  if (found.id === user.id) {
    return NextResponse.json({ error: 'Cannot add yourself' }, { status: 400 })
  }

  const { data, error } = await supabase.from('contacts').upsert({
    user_id: user.id,
    contact_id: found.id,
    nickname: nickname || found.name,
  })
    .select('*, contact:profiles!contacts_contact_id_fkey(id, name, avatar_url)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export const dynamic = 'force-dynamic'
