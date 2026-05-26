import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { getUser } from '@/lib/auth'

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createSupabaseAdmin()

  const [{ data: inbox }, { data: sent }] = await Promise.all([
    supabase
      .from('tasks')
      .select(`
        *,
        package:instruction_packages(title, estimated_minutes, domain),
        sender:profiles!tasks_sender_id_fkey(name, avatar_url)
      `)
      .eq('executor_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('tasks')
      .select(`
        *,
        package:instruction_packages(title, estimated_minutes, domain),
        executor:profiles!tasks_executor_id_fkey(name, avatar_url)
      `)
      .eq('sender_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  return NextResponse.json({ inbox: inbox || [], sent: sent || [] })
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { packageId, executorId } = await req.json()
  const supabase = createSupabaseAdmin()

  const { data: pkg } = await supabase
    .from('instruction_packages')
    .select('steps')
    .eq('id', packageId)
    .single()

  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      package_id: packageId,
      sender_id: user.id,
      executor_id: executorId,
      total_steps: pkg?.steps?.length ?? 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  supabase.from('contacts')
    .select('task_count')
    .eq('user_id', user.id)
    .eq('contact_id', executorId)
    .single()
    .then(({ data }) => {
      if (data) {
        supabase.from('contacts')
          .update({ task_count: (data.task_count || 0) + 1 })
          .eq('user_id', user.id)
          .eq('contact_id', executorId)
          .then(() => {})
      }
    })

  return NextResponse.json(task)
}

export const dynamic = 'force-dynamic'
