import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token')
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

    const supabase = createSupabaseAdmin()
    const { data, error } = await supabase
      .from('instruction_packages')
      .select('id, share_token, title, description, domain, estimated_minutes, steps, sender_profile, created_at')
      .eq('share_token', token)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
export const dynamic = 'force-dynamic'
