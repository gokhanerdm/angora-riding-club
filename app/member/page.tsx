import { createClient } from '@/lib/supabase/server'
import ReservationCalendar from '@/components/member/ReservationCalendar'
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
    supabase.from('members').select('name').eq('user_id', user.id).single()
  ])

  const stats = statsResult.data?.[0] as MemberStats ?? {
    total_lessons: 0, used_lessons: 0, remaining_lessons: 0, reserved_lessons: 0
  }
  const memberName = memberResult.data?.name ?? ''

  return (
    <div>
      <div className="mb-8">
        <p className="text-gray-500 font-medium mt-1">Hoş Geldin, <span className="font-bold text-gray-900">{memberName}</span></p>
      </div>

      <MemberDashboardClient stats={stats} userId={user.id} />

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Rezervasyon Takvimi</h2>
        <ReservationCalendar />
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        
          <a href="/member/packages" className="inline-block bg-amber-500 text-white px-6 py-3 rounded-lg font-bold hover:bg-amber-600">
  Üyelik Seçenekleri
</a>
      </div>
    </div>
  )
}