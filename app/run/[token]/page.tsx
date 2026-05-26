import { Metadata } from 'next'
import ExecutorClient from './ExecutorClient'
import { createSupabaseAdmin } from '@/lib/supabase'

interface Props {
  params: Promise<{ token: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  try {
    const supabase = createSupabaseAdmin()
    const { data } = await supabase
      .from('instruction_packages')
      .select('title, description')
      .eq('share_token', token)
      .single()

    return {
      title: data ? `${data.title}  -  Heiko` : 'Heiko Guide',
      description: data?.description || 'Step-by-step guided execution',
    }
  } catch {
    return { title: 'Heiko Guide' }
  }
}

export default async function RunPage({ params }: Props) {
  const { token } = await params
  return <ExecutorClient token={token} />
}
