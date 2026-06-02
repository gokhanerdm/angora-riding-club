import { requireAdmin } from '@/lib/auth/server-protection'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import MemberDashboardClient from '@/components/member/MemberDashboardClient'

interface MemberStats {
  total_lessons: number
  used_lessons: number
  remaining_lessons: number
  reserved_lessons: number
}

export default async function AdminMemberViewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params
  const supabase = await createClient()

  const { data: member } = await supabase
    .from('members')
    .select('id, user_id, name, surname, profile_photo_url, default_trainer_id, referral_code')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (!member) redirect('/admin/members')

  // Stats
  let stats: MemberStats = { total_lessons: 0, used_lessons: 0, remaining_lessons: 0, reserved_lessons: 0 }
  if (member.user_id) {
    const { data: statsData } = await supabase.rpc('member_dashboard_stats', { user_id: member.user_id })
    if (statsData?.[0]) stats = statsData[0] as MemberStats
  }

  // Trainer name
  let trainerName = ''
  if (member.default_trainer_id) {
    const { data: t } = await supabase
      .from('trainers').select('name, surname')
      .eq('id', member.default_trainer_id).single()
    if (t) trainerName = `${t.name} ${t.surname}`
  }

  return (
    <div
      className="fixed inset-0 z-[100] overflow-y-auto"
      style={{ background: 'linear-gradient(160deg, #0a0f2e, #0d1b4b, #071428)' }}
    >
      {/* Geri butonu */}
      <div className="absolute top-3 left-4 z-10">
        <Link
          href="/admin/members"
          className="flex items-center gap-2 text-sm font-bold px-3 py-2 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.08)', color: '#7b93c4' }}
        >
          ←
        </Link>
      </div>

      {/* Üyenin kendi paneli */}
      <MemberDashboardClient
        stats={stats}
        userId={member.user_id ?? ''}
        memberName={member.name}
        trainerName={trainerName}
        profilePhotoUrl={member.profile_photo_url}
        referralCode={member.referral_code}
        adminMemberId={id}
      />
    </div>
  )
}
