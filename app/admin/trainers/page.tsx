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
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(p)
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default async function AdminTrainersPage() {
  const supabase = await createClient()

  // Tüm aktif eğitmenler
  const { data: trainers } = await supabase
    .from('trainers')
    .select('id, name, surname, bonus_rate')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (!trainers || trainers.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Eğitmenler</h1>
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400">
          Henüz eğitmen yok.
        </div>
      </div>
    )
  }

  const trainerIds = trainers.map((t) => t.id)

  // Ay aralığı (prim için)
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`
  const todayKey = toDateKey(now)

  // Bugünkü dersler (eğitmen başına sayım için) + ay primi (fiyat snapshot ile)
  const [{ data: todayRes }, { data: primRes }] = await Promise.all([
    supabase
      .from('reservations')
      .select('trainer_id')
      .in('trainer_id', trainerIds)
      .eq('scheduled_date', todayKey)
      .neq('status', 'cancelled'),
    supabase
      .from('reservations')
      .select('trainer_id, memberships(lesson_price_snapshot)')
      .in('trainer_id', trainerIds)
      .gte('scheduled_date', monthStart)
      .lt('scheduled_date', monthEnd)
      .in('status', ['completed', 'no_show']),
  ])

  // Bugünkü ders sayısı haritası
  const todayMap = new Map<string, number>()
  for (const r of todayRes ?? []) {
    todayMap.set(r.trainer_id, (todayMap.get(r.trainer_id) ?? 0) + 1)
  }

  // Prim haritası: detay sayfasıyla AYNI mantık — satış fiyatı snapshot × bonus_rate
  const bonusMap = new Map(trainers.map((t) => [t.id, t.bonus_rate ?? 0]))
  const primMap = new Map<string, number>()
  for (const r of (primRes ?? []) as any[]) {
    const membership = Array.isArray(r.memberships) ? r.memberships[0] : r.memberships
    const lessonPrice = membership?.lesson_price_snapshot ?? 0
    const rate = bonusMap.get(r.trainer_id) ?? 0
    primMap.set(r.trainer_id, (primMap.get(r.trainer_id) ?? 0) + lessonPrice * (rate / 100))
  }

  const cards: TrainerCard[] = trainers.map((t) => ({
    id: t.id,
    name: t.name,
    surname: t.surname,
    today_lessons: todayMap.get(t.id) ?? 0,
    monthly_prim: primMap.get(t.id) ?? 0,
  }))

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Eğitmenler</h1>

      <div className="space-y-3">
        {cards.map((t) => (
          <Link
            key={t.id}
            href={`/admin/trainers/${t.id}`}
            className="block bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-400 transition-colors active:scale-[0.99]"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-bold text-gray-900 text-lg truncate">
                  {t.name} {t.surname}
                </p>
                <p className="text-sm text-gray-500 mt-0.5">
                  Bugün {t.today_lessons} ders
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-gray-400">Bu ay prim</p>
                <p className="font-bold text-amber-600 text-lg">
                  {formatPrice(t.monthly_prim)}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
