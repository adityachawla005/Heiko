import { requireUser, getProfile } from '@/lib/auth'
import { createSupabaseAdmin } from '@/lib/supabase'
import InboxClient from '../InboxClient'

export default async function AppHomePage() {
  const user = await requireUser()
  const supabase = createSupabaseAdmin()

  const [profile, { data: inbox }, { data: sent }] = await Promise.all([
    getProfile(user.id),
    supabase
      .from('tasks')
      .select(`
        *,
        package:instruction_packages(title, estimated_minutes, domain),
        sender:profiles!tasks_sender_id_fkey(id, name)
      `)
      .eq('executor_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('tasks')
      .select(`
        *,
        package:instruction_packages(title, estimated_minutes, domain),
        executor:profiles!tasks_executor_id_fkey(id, name)
      `)
      .eq('sender_id', user.id)
      .neq('executor_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  return (
    <InboxClient
      userName={profile?.name || 'You'}
      userId={user.id}
      inbox={inbox || []}
      sent={sent || []}
    />
  )
}
