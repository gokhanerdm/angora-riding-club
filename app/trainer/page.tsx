import { requireTrainer } from "@/lib/auth/server-protection";
import { createClient } from "@/lib/supabase/server";
import TrainerDashboardClient from "./TrainerDashboardClient";

export default async function TrainerDashboardPage() {
  const trainer = await requireTrainer();
  const supabase = await createClient();

  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }))
  const todayKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
  const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
  const nextMonth = new Date(now.getFullYear(), now.getMonth()+1, 1)
  const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth()+1).padStart(2,'0')}-01`
  const nextNextMonth = new Date(now.getFullYear(), now.getMonth()+2, 1)
  const nextMonthEnd = `${nextNextMonth.getFullYear()}-${String(nextNextMonth.getMonth()+1).padStart(2,'0')}-01`
  const nextMonthStart = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth()+1).padStart(2,'0')}-01`

  const [statsResult, monthResult, nextMonthResult, trainerResult, primResult, completedResult] = await Promise.all([
    supabase.rpc("get_trainer_stats", { p_trainer_id: trainer.trainerId }).single<{
      today_lessons: number; week_lessons: number; completed_lessons: number
    }>(),
    // Bu ay yapılacak: bugün dahil ay sonuna kadar pending/approved
    supabase.from('reservations')
      .select('id', { count: 'exact' })
      .eq('trainer_id', trainer.trainerId)
      .gte('scheduled_date', todayKey)
      .lt('scheduled_date', monthEnd)
      .in('status', ['pending', 'approved']),
    // Sonraki ay yapılacak: sadece pending/approved
    supabase.from('reservations')
      .select('id', { count: 'exact' })
      .eq('trainer_id', trainer.trainerId)
      .gte('scheduled_date', nextMonthStart)
      .lt('scheduled_date', nextMonthEnd)
      .in('status', ['pending', 'approved']),
    supabase.from('trainers').select('bonus_rate, shift').eq('id', trainer.trainerId).is('deleted_at', null).single(),
    supabase.from('reservations')
      .select('member_id, memberships(lesson_price_snapshot)')
      .eq('trainer_id', trainer.trainerId)
      .gte('scheduled_date', monthStart)
      .lt('scheduled_date', monthEnd)
      .in('status', ['completed', 'no_show']),
    // Bu ay yapılan: completed + no_show
    supabase.from('reservations')
      .select('id', { count: 'exact' })
      .eq('trainer_id', trainer.trainerId)
      .gte('scheduled_date', monthStart)
      .lt('scheduled_date', monthEnd)
      .in('status', ['completed', 'no_show']),
  ])

  const stats = statsResult.data ?? { today_lessons: 0, week_lessons: 0, completed_lessons: 0 }
  const bonusRate = trainerResult.data?.bonus_rate ?? 0
  const initialShift = trainerResult.data?.shift ?? 'fullday'

  let monthlyPrim = 0
  for (const r of (primResult.data ?? []) as any[]) {
    const membership = Array.isArray(r.memberships) ? r.memberships[0] : r.memberships
    monthlyPrim += (membership?.lesson_price_snapshot ?? 0) * (bonusRate / 100)
  }

  return (
    <TrainerDashboardClient
      trainerId={trainer.trainerId}
      trainerName={trainer.name ?? ''}
      initialShift={initialShift}
      stats={{
        today_lessons: stats.today_lessons,
        completed_lessons: completedResult.count ?? 0,
        monthly_reserved: monthResult.count ?? 0,
        next_month_reserved: nextMonthResult.count ?? 0,
        monthly_prim: monthlyPrim,
      }}
    />
  );
}
