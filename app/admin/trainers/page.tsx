import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

type TrainerCard = {
  id: string
  name: string
  surname: string
  today_lessons: number
  monthly_prim: number
}

function formatPrice(p: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(p)
}

function pad(n: number) { return String(n).padStart(2, '0') }

function todayKey() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }))
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default async function AdminTrainersPage() {
  const supabase = await createClient()

  const { data: trainers } = await supabase
    .from('trainers')
    .select('id, name, surname, bonus_rate')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (!trainers || trainers.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-white mb-6">Eğitmenler</h1>
        <div className="rounded-2xl p-8 text-center" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#7b93c4' }}>
          Henüz eğitmen yok.
        </div>
      </div>
    )
  }

  const trainerIds = trainers.map(t => t.id)
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }))
  const monthStart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const monthEnd = `${nextMonth.getFullYear()}-${pad(nextMonth.getMonth() + 1)}-01`

  const [{ data: todayRes }, { data: primRes }] = await Promise.all([
    supabase.from('reservations').select('trainer_id').in('trainer_id', trainerIds).eq('scheduled_date', todayKey()).neq('status', 'cancelled'),
    supabase.from('reservations').select('trainer_id, memberships(lesson_price_snapshot)').in('trainer_id', trainerIds).gte('scheduled_date', monthStart).lt('scheduled_date', monthEnd).in('status', ['completed', 'no_show']),
  ])

  const todayMap = new Map<string, number>()
  for (const r of todayRes ?? []) todayMap.set(r.trainer_id, (todayMap.get(r.trainer_id) ?? 0) + 1)

  const bonusMap = new Map(trainers.map(t => [t.id, t.bonus_rate ?? 0]))
  const primMap = new Map<string, number>()
  for (const r of (primRes ?? []) as any[]) {
    const membership = Array.isArray(r.memberships) ? r.memberships[0] : r.memberships
    const price = membership?.lesson_price_snapshot ?? 0
    const rate = bonusMap.get(r.trainer_id) ?? 0
    primMap.set(r.trainer_id, (primMap.get(r.trainer_id) ?? 0) + price * (rate / 100))
  }

  const cards: TrainerCard[] = trainers.map(t => ({
    id: t.id,
    name: t.name,
    surname: t.surname,
    today_lessons: todayMap.get(t.id) ?? 0,
    monthly_prim: primMap.get(t.id) ?? 0,
  }))

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Eğitmenler</h1>
      <div className="space-y-3">
        {cards.map(t => (
          <Link key={t.id} href={`/admin/trainers/${t.id}`}>
            <div
              className="rounded-2xl px-4 py-3 flex items-center justify-between active:opacity-70"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <p className="text-sm font-bold text-white">{t.name} {t.surname}</p>
              <p className="text-xs font-bold flex-shrink-0" style={{ color: '#f59e0b' }}>
                Bugün {t.today_lessons} ders
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
