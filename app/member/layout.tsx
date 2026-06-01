import { requireMember } from '@/lib/auth/server-protection'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const user = await requireMember()
  const supabase = await createClient()

  // Profil tamamlanmış mı kontrol et (setup sayfasında bu kontrolü atla)
  const { data: member } = await supabase
    .from('members')
    .select('profile_completed')
    .eq('user_id', user.id)
    .single()

  return <>{children}</>
}
