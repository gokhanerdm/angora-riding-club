'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]} ${d.getFullYear()}`
}

function formatTime(timeStr: string) {
  return timeStr.substring(0, 5)
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    pending: 'Beklemede',
    approved: 'Onaylı',
    completed: 'Tamamlandı',
    no_show: 'Gelmedi',
    cancelled: 'İptal',
  }
  return map[status] ?? status
}

function statusColor(status: string) {
  if (status === 'completed') return 'text-green-400'
  if (status === 'no_show') return 'text-red-400'
  if (status === 'cancelled') return 'text-gray-500'
  return 'text-gray-300'
}

function isLessonFinished(scheduledDate: string, endTime: string): boolean {
  const now = new Date()
  const lessonEnd = new Date(`${scheduledDate}T${endTime}`)
  return now >= lessonEnd
}

type Stats = {
  today_lessons: number
  week_lessons: number
  completed_lessons: number
}

type Lesson = {
  id: string
  scheduled_date: string
  start_time: string
  end_time: string
  status: string
  member_name: string
}

type MonthSummary = {
  month: number
  year: number
  lesson_count: number
}

type MonthPrim = {
  month: number
  year: number
  total_prim: number
  paid_prim: number
  remaining_prim: number
}

type ModalType = 'today' | 'week' | 'monthly' | 'prim' | null

export default function TrainerDashboardClient({
  trainerId,
  trainerName,
  stats,
}: {
  trainerId: string
  trainerName: string
  stats: Stats
}) {
  const [modal, setModal] = useState<ModalType>(null)
  const [loading, setLoading] = useState(false)
  const [todayLessons, setTodayLessons] = useState<Lesson[]>([])
  const [weekLessons, setWeekLessons] = useState<Lesson[]>([])
  const [monthSummaries, setMonthSummaries] = useState<MonthSummary[]>([])
  const [monthPrims, setMonthPrims] = useState<MonthPrim[]>([])

  const markLesson = async (reservationId: string, status: 'completed' | 'no_show') => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('attendance').insert({
      reservation_id: reservationId,
      status,
      marked_by: user?.id,
    })

    await supabase.from('reservations').update({ status }).eq('id', reservationId)

    setTodayLessons(prev => prev.map(l => l.id === reservationId ? { ...l, status } : l))
    setWeekLessons(prev => prev.map(l => l.id === reservationId ? { ...l, status } : l))
  }

  const openModal = async (type: ModalType) => {
    setModal(type)
    setLoading(true)
    const supabase = createClient()

    if (type === 'today') {
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('reservations')
        .select('id, scheduled_date, start_time, end_time, status, members(name, surname)')
        .eq('trainer_id', trainerId)
        .eq('scheduled_date', today)
        .neq('status', 'cancelled')
        .order('start_time', { ascending: true })

      setTodayLessons(
        (data ?? []).map((r: any) => ({
          id: r.id,
          scheduled_date: r.scheduled_date,
          start_time: r.start_time,
          end_time: r.end_time,
          status: r.status,
          member_name: r.members ? `${r.members.name} ${r.members.surname}` : 'Bilinmiyor',
        }))
      )
    }

    if (type === 'week') {
      const now = new Date()
      const day = now.getDay()
      const monday = new Date(now)
      monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)

      const { data } = await supabase
        .from('reservations')
        .select('id, scheduled_date, start_time, end_time, status, members(name, surname)')
        .eq('trainer_id', trainerId)
        .gte('scheduled_date', monday.toISOString().split('T')[0])
        .lte('scheduled_date', sunday.toISOString().split('T')[0])
        .neq('status', 'cancelled')
        .order('scheduled_date', { ascending: true })

      setWeekLessons(
        (data ?? []).map((r: any) => ({
          id: r.id,
          scheduled_date: r.scheduled_date,
          start_time: r.start_time,
          end_time: r.end_time,
          status: r.status,
          member_name: r.members ? `${r.members.name} ${r.members.surname}` : 'Bilinmiyor',
        }))
      )
    }

    if (type === 'monthly') {
      const { data } = await supabase
        .from('reservations')
        .select('scheduled_date')
        .eq('trainer_id', trainerId)
        .neq('status', 'cancelled')

      const map = new Map<string, number>()
      for (const r of data ?? []) {
        const d = new Date(r.scheduled_date + 'T00:00:00')
        const key = `${d.getFullYear()}-${d.getMonth()}`
        map.set(key, (map.get(key) ?? 0) + 1)
      }

      const summaries: MonthSummary[] = Array.from(map.entries())
        .map(([key, count]) => {
          const [year, month] = key.split('-').map(Number)
          return { year, month, lesson_count: count }
        })
        .sort((a, b) => b.year - a.year || b.month - a.month)

      setMonthSummaries(summaries)
    }

    if (type === 'prim') {
      const { data: trainerData } = await supabase
        .from('trainers')
        .select('bonus_rate')
        .eq('id', trainerId)
        .single()

      const bonusRate = trainerData?.bonus_rate ?? 0

      const { data: reservations } = await supabase
        .from('reservations')
        .select('scheduled_date, member_id, status')
        .eq('trainer_id', trainerId)
        .in('status', ['completed', 'no_show'])

      const memberIds = [...new Set((reservations ?? []).map((r: any) => r.member_id))]

      const { data: memberships } = await supabase
        .from('memberships')
        .select('member_id, lesson_price_snapshot')
        .in('member_id', memberIds)
        .eq('is_current', true)

      const lessonPriceMap = new Map<string, number>()
      for (const m of memberships ?? []) {
        lessonPriceMap.set(m.member_id, m.lesson_price_snapshot)
      }

      const map = new Map<string, number>()
      for (const r of reservations ?? []) {
        const d = new Date((r as any).scheduled_date + 'T00:00:00')
        const key = `${d.getFullYear()}-${d.getMonth()}`
        const lessonPrice = lessonPriceMap.get((r as any).member_id) ?? 0
        const prim = lessonPrice * (bonusRate / 100)
        map.set(key, (map.get(key) ?? 0) + prim)
      }

      const prims: MonthPrim[] = Array.from(map.entries())
        .map(([key, total]) => {
          const [year, month] = key.split('-').map(Number)
          return { year, month, total_prim: total, paid_prim: 0, remaining_prim: total }
        })
        .sort((a, b) => b.year - a.year || b.month - a.month)

      setMonthPrims(prims)
    }

    setLoading(false)
  }

  const cards = [
    { label: 'Bugünkü Dersler', value: stats.today_lessons, type: 'today' as ModalType },
    { label: 'Bu Haftaki Dersler', value: stats.week_lessons, type: 'week' as ModalType },
    { label: 'Aylık Dersler', value: stats.completed_lessons, type: 'monthly' as ModalType },
    { label: 'Prim', value: null, type: 'prim' as ModalType },
  ]

  const lessons = modal === 'today' ? todayLessons : weekLessons

  return (
    <div className="text-white">
      <h1 className="mb-8 text-3xl font-bold">Hoş geldin, {trainerName}</h1>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <button
            key={card.type}
            onClick={() => openModal(card.type)}
            className="rounded-lg bg-gray-800 p-6 text-left hover:bg-gray-700 transition-colors"
          >
            <h3 className="mb-2 text-sm text-gray-400">{card.label}</h3>
            {card.value !== null ? (
              <p className="text-4xl font-bold">{card.value}</p>
            ) : (
              <p className="text-sm text-gray-500 mt-2">Tıkla ve gör →</p>
            )}
          </button>
        ))}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">
                {modal === 'today' && 'Bugünkü Dersler'}
                {modal === 'week' && 'Bu Haftaki Dersler'}
                {modal === 'monthly' && 'Aylık Dersler'}
                {modal === 'prim' && 'Prim'}
              </h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-white text-2xl font-bold">✕</button>
            </div>

            {loading && <p className="text-center text-gray-400 py-8">Yükleniyor...</p>}

            {!loading && (modal === 'today' || modal === 'week') && (
              <div className="space-y-3">
                {lessons.length === 0 && (
                  <p className="text-gray-400 text-center py-8">Ders bulunamadı.</p>
                )}
                {lessons.map(lesson => {
                  const isDone = ['completed', 'no_show', 'cancelled'].includes(lesson.status)
                  const isFinished = isLessonFinished(lesson.scheduled_date, lesson.end_time)
                  return (
                    <div key={lesson.id} className="rounded-lg bg-gray-700 p-4">
                      <div className="flex justify-between items-center mb-3">
                        <div>
                          {modal === 'week' && (
                            <p className="text-sm text-gray-400">{formatDate(lesson.scheduled_date)}</p>
                          )}
                          <p className="font-bold text-white">
                            {formatTime(lesson.start_time)} — {formatTime(lesson.end_time)}
                          </p>
                          <p className="text-sm text-gray-300">{lesson.member_name}</p>
                        </div>
                        <span className={`text-sm font-bold ${statusColor(lesson.status)}`}>
                          {statusLabel(lesson.status)}
                        </span>
                      </div>
                      {!isDone && isFinished && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => markLesson(lesson.id, 'completed')}
                            className="flex-1 bg-green-600 text-white font-bold py-2 rounded-lg hover:bg-green-700 text-sm"
                          >
                            Tamamlandı
                          </button>
                          <button
                            onClick={() => markLesson(lesson.id, 'no_show')}
                            className="flex-1 bg-red-600 text-white font-bold py-2 rounded-lg hover:bg-red-700 text-sm"
                          >
                            Gelmedi
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {!loading && modal === 'monthly' && (
              <div className="space-y-2">
                {monthSummaries.length === 0 && (
                  <p className="text-gray-400 text-center py-8">Veri bulunamadı.</p>
                )}
                {monthSummaries.map(s => (
                  <div key={`${s.year}-${s.month}`} className="rounded-lg bg-gray-700 p-4 flex justify-between items-center">
                    <p className="font-bold text-white">{MONTHS_TR[s.month]} {s.year}</p>
                    <p className="text-2xl font-bold text-white">{s.lesson_count} Ders</p>
                  </div>
                ))}
              </div>
            )}

            {!loading && modal === 'prim' && (
              <div className="space-y-2">
                {monthPrims.length === 0 && (
                  <p className="text-gray-400 text-center py-8">Prim verisi bulunamadı.</p>
                )}
                {monthPrims.map(p => (
                  <div key={`${p.year}-${p.month}`} className="rounded-lg bg-gray-700 p-4">
                    <div className="flex justify-between items-center mb-2">
                      <p className="font-bold text-white">{MONTHS_TR[p.month]} {p.year}</p>
                      <p className="text-xl font-bold text-amber-400">
                        {p.remaining_prim.toLocaleString('tr-TR', { minimumFractionDigits: 0 })} ₺
                      </p>
                    </div>
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>Toplam: {p.total_prim.toLocaleString('tr-TR')} ₺</span>
                      <span>Ödenen: {p.paid_prim.toLocaleString('tr-TR')} ₺</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}