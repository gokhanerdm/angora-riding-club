'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const SLOTS = [
  "15:00:00","15:30:00","16:00:00","16:30:00",
  "17:00:00","17:30:00","18:00:00","18:30:00",
  "19:00:00","19:30:00","20:00:00","20:30:00",
  "21:00:00","21:30:00","22:00:00",
]

const STATUS_LABELS: Record<string, string> = {
  pending:   "Beklemede",
  approved:  "Onaylı",
  cancelled: "İptal",
  completed: "Tamamlandı",
  no_show:   "Gelmedi",
}

const MONTHS_TR = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']
const DAYS_TR   = ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt']

function formatDayLabel(dateKey: string, isToday: boolean): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date  = new Date(y, m - 1, d)
  const label = `${d} ${MONTHS_TR[date.getMonth()]} ${DAYS_TR[date.getDay()]}`
  return isToday ? `${label} · Bugün` : label
}

function addThirtyMin(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const total  = h * 60 + m + 30
  return `${String(Math.floor(total / 60)).padStart(2,'0')}:${String(total % 60).padStart(2,'0')}:00`
}

type DayInfo         = { key: string; isToday: boolean }
type ReservationInfo = { id: string; member_name: string; status: string; type: string }
type AttendanceModal = { reservationId: string; memberName: string; date: string; time: string }

type Props = {
  trainerId:    string
  days:         DayInfo[]
  closedSlots:  string[]
  reservations: Record<string, ReservationInfo>
}

const CARD = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }

export default function TrainerScheduleClient({ trainerId, days, closedSlots, reservations }: Props) {
  const [closed, setClosed]               = useState<Set<string>>(new Set(closedSlots))
  const [loading, setLoading]             = useState<string | null>(null)
  const [attendanceModal, setAttendanceModal] = useState<AttendanceModal | null>(null)
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [localStatuses, setLocalStatuses] = useState<Record<string, string>>({})
  const [feedback, setFeedback]           = useState<{ msg: string; ok: boolean } | null>(null)

  const showFeedback = (msg: string, ok: boolean) => {
    setFeedback({ msg, ok })
    setTimeout(() => setFeedback(null), 3000)
  }

  const toggle = async (dayKey: string, slot: string) => {
    const mapKey = `${dayKey}|${slot}`
    if (reservations[mapKey] || loading) return

    setLoading(mapKey)
    const supabase = createClient()

    if (closed.has(mapKey)) {
      const { error } = await supabase
        .from("trainer_schedules").delete()
        .eq("trainer_id", trainerId).eq("scheduled_date", dayKey).eq("start_time", slot)
      if (!error) setClosed(prev => { const n = new Set(prev); n.delete(mapKey); return n })
    } else {
      const { error } = await supabase
        .from("trainer_schedules").insert({
          trainer_id:     trainerId,
          scheduled_date: dayKey,
          start_time:     slot,
          end_time:       addThirtyMin(slot),
          is_available:   false,
        })
      if (!error) setClosed(prev => new Set(prev).add(mapKey))
    }
    setLoading(null)
  }

  const openAttendance = (dayKey: string, slot: string) => {
    const mapKey      = `${dayKey}|${slot}`
    const reservation = reservations[mapKey]
    if (!reservation) return
    const currentStatus = localStatuses[mapKey] ?? reservation.status
    if (currentStatus === 'completed' || currentStatus === 'no_show') return
    setAttendanceModal({ reservationId: reservation.id, memberName: reservation.member_name, date: dayKey, time: slot })
  }

  const markAttendance = async (status: 'completed' | 'no_show') => {
    if (!attendanceModal) return
    setAttendanceLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.rpc('mark_attendance', {
      p_reservation_id: attendanceModal.reservationId,
      p_status:         status,
      p_marked_by:      user?.id,
    })

    if (!error) {
      const mapKey = `${attendanceModal.date}|${attendanceModal.time}`
      setLocalStatuses(prev => ({ ...prev, [mapKey]: status }))
      showFeedback(status === 'completed' ? 'Ders tamamlandı.' : 'Gelmedi olarak işaretlendi.', true)
    } else {
      showFeedback('İşlem başarısız: ' + error.message, false)
    }

    setAttendanceLoading(false)
    setAttendanceModal(null)
  }

  const getSlotStatus = (dayKey: string, slot: string) => {
    const mapKey      = `${dayKey}|${slot}`
    const reservation = reservations[mapKey]
    if (!reservation) return null
    return localStatuses[mapKey] ?? reservation.status
  }

  return (
    <>
      {/* Toast */}
      {feedback && (
        <div
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-bold text-white"
          style={{
            background: feedback.ok ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)',
            border: `1px solid ${feedback.ok ? 'rgba(52,211,153,0.4)' : 'rgba(248,113,113,0.4)'}`,
            backdropFilter: 'blur(8px)',
          }}
        >
          {feedback.msg}
        </div>
      )}

      {/* Haftalık grid */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
        {days.map((day) => {
          const dayKey = day.key
          return (
            <div
              key={dayKey}
              className="rounded-2xl p-3"
              style={day.isToday
                ? { background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }
                : CARD}
            >
              <h2
                className="mb-3 text-xs font-bold"
                style={{ color: day.isToday ? '#f59e0b' : '#7b93c4' }}
              >
                {formatDayLabel(dayKey, day.isToday)}
              </h2>
              <ul className="space-y-1">
                {SLOTS.map((slot) => {
                  const mapKey     = `${dayKey}|${slot}`
                  const reservation = reservations[mapKey]
                  const isClosed   = closed.has(mapKey)
                  const isLoading  = loading === mapKey
                  const slotStatus = getSlotStatus(dayKey, slot)

                  if (reservation) {
                    const isDone  = slotStatus === 'completed' || slotStatus === 'no_show'
                    const isTrial = reservation.type === 'trial'
                    let bg     = 'rgba(56,189,248,0.12)'
                    let border = '1px solid rgba(56,189,248,0.25)'
                    let color  = '#38bdf8'
                    if (slotStatus === 'completed') { bg = 'rgba(52,211,153,0.12)'; border = '1px solid rgba(52,211,153,0.25)'; color = '#34d399' }
                    if (slotStatus === 'no_show')   { bg = 'rgba(248,113,113,0.12)'; border = '1px solid rgba(248,113,113,0.25)'; color = '#f87171' }
                    if (isTrial) { bg = 'rgba(245,158,11,0.15)'; border = '1px solid rgba(245,158,11,0.4)' }
                    return (
                      <li key={slot}>
                        <button
                          onClick={() => openAttendance(dayKey, slot)}
                          disabled={isDone}
                          className="w-full rounded-xl px-2 py-2 text-left transition-opacity disabled:cursor-default"
                          style={{ background: bg, border }}
                        >
                          <p className="text-xs font-bold text-white">
                            {slot.substring(0,5)}
                            {isTrial && (
                              <span className="ml-1 px-1 py-0.5 rounded font-bold text-[9px]"
                                style={{ background: 'rgba(245,158,11,0.3)', color: '#f59e0b' }}>DD</span>
                            )}
                          </p>
                          <p className="text-xs truncate" style={{ color: '#c8d6f0' }}>
                            {reservation.member_name}
                          </p>
                          <p className="text-[10px] font-bold mt-0.5" style={{ color: isTrial ? '#f59e0b' : color }}>{STATUS_LABELS[slotStatus ?? reservation.status]}</p>
                        </button>
                      </li>
                    )
                  }

                  if (isClosed) {
                    return (
                      <li key={slot}>
                        <button
                          onClick={() => toggle(dayKey, slot)}
                          disabled={!!loading}
                          className="w-full rounded-xl px-2 py-2 text-left opacity-40 hover:opacity-60 transition-opacity"
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                        >
                          <p className="text-xs font-bold" style={{ color: '#7b93c4' }}>{slot.substring(0,5)}</p>
                          <p className="text-[10px]" style={{ color: '#4a6190' }}>{isLoading ? "..." : "Kapalı"}</p>
                        </button>
                      </li>
                    )
                  }

                  return (
                    <li key={slot}>
                      <button
                        onClick={() => toggle(dayKey, slot)}
                        disabled={!!loading}
                        className="w-full rounded-xl px-2 py-2 text-left hover:opacity-80 transition-opacity"
                        style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.12)' }}
                      >
                        <p className="text-xs font-bold text-white">{slot.substring(0,5)}</p>
                        <p className="text-[10px] font-bold" style={{ color: '#34d399' }}>{isLoading ? "..." : "Müsait"}</p>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>

      {/* Yoklama modalı */}
      {attendanceModal && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div
            className="w-full rounded-t-3xl p-6"
            style={{ background: '#0d1b4b', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <h3 className="text-lg font-bold text-white mb-1">Ders Durumu</h3>
            <p className="font-bold mb-0.5" style={{ color: '#c8d6f0' }}>{attendanceModal.memberName}</p>
            <p className="text-sm mb-6" style={{ color: '#7b93c4' }}>
              {attendanceModal.date} — {attendanceModal.time.substring(0,5)}
            </p>
            <div className="mb-3">
<button
                onClick={() => markAttendance('no_show')}
                disabled={attendanceLoading}
                className="w-full py-3 rounded-2xl font-bold disabled:opacity-50"
                style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}
              >
                Üye Gelmedi
              </button>
            </div>
            <button
              onClick={() => setAttendanceModal(null)}
              className="w-full py-2 text-sm font-bold rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#7b93c4' }}
            >
              İptal
            </button>
          </div>
        </div>
      )}
    </>
  )
}
