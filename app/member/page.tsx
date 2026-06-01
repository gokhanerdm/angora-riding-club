import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MemberDashboardClient from '@/components/member/MemberDashboardClient'

interface MemberStats {
  total_lessons: number
  used_lessons: number
  remaining_lessons: number
  reserved_lessons: number
}

export default async function MemberDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [statsResult, memberResult] = await Promise.all([
    supabase.rpc('member_dashboard_stats', { user_id: user.id }),
    supabase.from('members')
      .select('id, name, profile_completed, profile_photo_url')
      .eq('user_id', user.id)
      .single()
  ])

  // Profil tamamlanmamışsa yönlendir
  if (memberResult.data && !memberResult.data.profile_completed) {
    redirect('/member/profile-setup')
  }

  const stats = statsResult.data?.[0] as MemberStats ?? {
    total_lessons: 0, used_lessons: 0, remaining_lessons: 0, reserved_lessons: 0
  }
  const memberId       = memberResult.data?.id
  const memberName     = memberResult.data?.name ?? ''
  const profilePhotoUrl = memberResult.data?.profile_photo_url ?? null

  let trainerName = ''
  if (memberId) {
    const { data: trainerData } = await supabase
      .from('member_allowed_trainers')
      .select('trainers(name, surname)')
      .eq('member_id', memberId)
      .limit(1)
      .single()

    if (trainerData) {
      const t = Array.isArray(trainerData.trainers) ? trainerData.trainers[0] : trainerData.trainers
      if (t) trainerName = `${t.name} ${t.surname}`
    }
  }

  return (
    <MemberDashboardClient
      stats={{
        total_lessons:    stats?.total_lessons ?? 0,
        used_lessons:     stats?.used_lessons ?? 0,
        remaining_lessons: stats?.remaining_lessons ?? 0,
        reserved_lessons: stats?.reserved_lessons ?? 0,
      }}
      userId={user.id}
      memberName={memberName}
      trainerName={trainerName}
      profilePhotoUrl={profilePhotoUrl}
    />
  )
}
