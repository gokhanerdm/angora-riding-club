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
      .select('id, name, profile_completed, profile_photo_url, default_trainer_id, referral_code, trial_lesson_requested, trial_lesson_used')
      .eq('user_id', user.id)
      .single()
  ])

  // Profil tamamlanmamışsa yönlendir (deneme dersi alanlar hariç — 2. kayıt sadece paket alan üyeler için)
  if (memberResult.data && !memberResult.data.profile_completed && !memberResult.data.trial_lesson_requested) {
    redirect('/member/profile-setup')
  }
  if (memberResult.data?.trial_lesson_requested && !memberResult.data.trial_lesson_used) {
    redirect('/member/trial-lesson')
  }

  const stats = statsResult.data?.[0] as MemberStats ?? {
    total_lessons: 0, used_lessons: 0, remaining_lessons: 0, reserved_lessons: 0
  }
  const memberId       = memberResult.data?.id
  const memberName     = memberResult.data?.name ?? ''
  const profilePhotoUrl = memberResult.data?.profile_photo_url ?? null
  const referralCode    = memberResult.data?.referral_code ?? null

  let trainerName = ''
  if (memberId) {
    // Önce member_allowed_trainers, yoksa default_trainer_id'den bak
    const { data: matData } = await supabase
      .from('member_allowed_trainers')
      .select('trainers(name, surname)')
      .eq('member_id', memberId)
      .limit(1)
      .single()

    if (matData) {
      const t = Array.isArray(matData.trainers) ? matData.trainers[0] : matData.trainers
      if (t) trainerName = `${t.name} ${t.surname}`
    }

    // Fallback: default_trainer_id
    if (!trainerName && memberResult.data?.default_trainer_id) {
      const { data: dtData } = await supabase
        .from('trainers')
        .select('name, surname')
        .eq('id', memberResult.data.default_trainer_id)
        .single()
      if (dtData) trainerName = `${dtData.name} ${dtData.surname}`
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
      referralCode={referralCode}
    />
  )
}
