import { requireTrainer } from "@/lib/auth/server-protection";
import { createClient } from "@/lib/supabase/server";
import TrainerDashboardClient from "./TrainerDashboardClient";

export default async function TrainerDashboardPage() {
  const trainer = await requireTrainer();
  const supabase = await createClient();

  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
  const nextMonth = new Date(now.getFullYear(), now.getMonth()+1, 1)
  const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth()+1).padStart(2,'0')}-01`

  const [statsResult, monthResResult, trainerResult] = await Promise.all([
    supabase.rpc("get_trainer_stats", { p_trainer_id: trainer.trainerId }).single<{
      today_lessons: number; week_lessons: number; completed_lessons: number
    }>(),
    supabase.from('reservations')
  .select('id', { count: 'exact' })
  .eq('trainer_id', trainer.trainerId)
  .gte('scheduled_date', monthStart)
  .lt('scheduled_date', monthEnd)
  .neq('status', 'cancelled'),
    supabase.from('trainers').select('bonus_rate').eq('id', trainer.trainerId).single()
  ])

  const stats = statsResult.data ?? { today_lessons: 0, week_lessons: 0, completed_lessons: 0 }
  const bonusRate = trainerResult.data?.bonus_rate ?? 0

  // Aylık prim hesabı
  let monthlyPrim = 0
  for (const r of (monthResResult.data ?? []) as any[]) {
    const membership = Array.isArray(r.memberships) ? r.memberships[0] : r.memberships
    const lessonPrice = membership?.lesson_price_snapshot ?? 0
    monthlyPrim += lessonPrice * (bonusRate / 100)
  }

  return (
    <TrainerDashboardClient
      trainerId={trainer.trainerId}
      trainerName={trainer.name}
      stats={{
        today_lessons: stats.today_lessons,
        completed_lessons: stats.completed_lessons,
        monthly_reserved: monthResResult.count ?? 0,
        monthly_prim: monthlyPrim,
      }}
    />
  );
}