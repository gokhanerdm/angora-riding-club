import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TrainerDashboardClient from '@/app/trainer/TrainerDashboardClient'

export default async function AdminTrainerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: trainer } = await supabase
    .from('trainers')
    .select('id, name, surname, bonus_rate')
    .eq('id', id)
    .single()

  if (!trainer) redirect('/admin/trainers')

  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
  const nextMonth = new Date(now.getFullYear(), now.getMonth()+1, 1)
  const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth()+1).padStart(2,'0')}-01`

  const [statsResult, monthResult, primResult] = await Promise.all([
    supabase.rpc("get_trainer_stats", { p_trainer_id: trainer.id }).single<{
      today_lessons: number; week_lessons: number; completed_lessons: number
    }>(),
    supabase.from('reservations')
      .select('id', { count: 'exact' })
      .eq('trainer_id', trainer.id)
      .gte('scheduled_date', monthStart)
      .lt('scheduled_date', monthEnd)
      .neq('status', 'cancelled'),
    supabase.from('reservations')
      .select('member_id, memberships(lesson_price_snapshot)')
      .eq('trainer_id', trainer.id)
      .gte('scheduled_date', monthStart)
      .lt('scheduled_date', monthEnd)
      .in('status', ['completed', 'no_show'])
  ])

  const stats = statsResult.data ?? { today_lessons: 0, week_lessons: 0, completed_lessons: 0 }
  const bonusRate = trainer.bonus_rate ?? 0

  let monthlyPrim = 0
  for (const r of (primResult.data ?? []) as any[]) {
    const membership = Array.isArray(r.memberships) ? r.memberships[0] : r.memberships
    monthlyPrim += (membership?.lesson_price_snapshot ?? 0) * (bonusRate / 100)
  }

  return (
    <div>
      <div className="mb-4">
        <a href="/admin/trainers" className="text-sm text-gray-500 hover:text-gray-900">← Eğitmenler</a>
      </div>
      <TrainerDashboardClient
        trainerId={trainer.id}
        trainerName={`${trainer.name} ${trainer.surname}`}
        stats={{
          today_lessons: stats.today_lessons,
          completed_lessons: stats.completed_lessons,
          monthly_reserved: monthResult.count ?? 0,
          monthly_prim: monthlyPrim,
        }}
      />
    </div>
  )
}