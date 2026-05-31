'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const SLOTS = [
  "15:00:00", "15:30:00", "16:00:00", "16:30:00",
  "17:00:00", "17:30:00", "18:00:00", "18:30:00",
  "19:00:00", "19:30:00", "20:00:00", "20:30:00",
  "21:00:00", "21:30:00", "22:00:00",
]

const STATUS_LABELS: Record<string, string> = {
  pending: "Beklemede",
  approved: "Onaylı",
  cancelled: "İptal",
  completed: "Tamamlandı",
  no_show: "Gelmedi",
}

const MONTHS_TR = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']
const DAYS_TR = ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt']

function formatDayLabel(dateKey: string, isToday: boolean): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const label = `${d} ${MONTHS_TR[date.getMonth()]} ${DAYS_TR[date.getDay()]}`
  return isToday ? `${label} · Bugün` : label
}

function addThirtyMin(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + 30
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}:00`
}

type DayInfo = { key: string; isToday: boolean }
type ReservationInfo = { id: string; member_name: string; status: string }

type Props = {
  trainerId: string
  days: DayInfo[]
  closedSlots: string[]
  reservations: Record<string, ReservationInfo>
}

type AttendanceModal = {
  reservationId: string
  memberName: string
  date: string
  time: string
}

export default function TrainerScheduleClient({ trainerId, days, closedSlots, reservations }: Props) {
  const [closed, setClosed] = useState<Set<string>>(new Set(closedSlots))
  const [loading, setLoading] = useState<string | null>(null)
  const [attendanceModal, setAttendanceModal] = useState<AttendanceModal | null>(null)
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [localStatuses, setLocalStatuses] = useState<Record<string, string>>({})

  const toggle = async (dayKey: string, slot: string) => {
    const mapKey = `${dayKey}|${slot}`
    if (reservations[mapKey] || loading) return

    setLoading(mapKey)
    const supabase = createClient()

    if (closed.has(mapKey)) {
      const { error } = await supabase
        .from("trainer_schedules")
        .delete()
        .eq("trainer_id", trainerId)
        .eq("scheduled_date", dayKey)
        .eq("start_time", slot)

      if (!error) {
        setClosed(prev => { const n = new Set(prev); n.delete(mapKey); return n })
      }
    } else {
      const { error } = await supabase
        .from("trainer_schedules")
        .insert({
          trainer_id: trainerId,
          scheduled_date: dayKey,
          start_time: slot,
          end_time: addThirtyMin(slot),
          is_available: false,
        })

      if (!error) {
        setClosed(prev => new Set(prev).add(mapKey))
      }
    }

    setLoading(null)
  }

  const openAttendance = (dayKey: string, slot: string) => {
    const mapKey = `${dayKey}|${slot}`
    const reservation = reservations[mapKey]
    if (!reservation) return

    const currentStatus = localStatuses[mapKey] ?? reservation.status
    if (currentStatus === 'completed' || currentStatus === 'no_show') return

    setAttendanceModal({
      reservationId: reservation.id,
      memberName: reservation.member_name,
      date: dayKey,
      time: slot,
    })
  }

  const markAttendance = async (status: 'completed' | 'no_show') => {
    if (!attendanceModal) return
    setAttendanceLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { error: attendanceError } = await supabase
      .from('attendance')
      .insert({
        reservation_id: attendanceModal.reservationId,
        status,
        marked_by: user?.id,
      })

    if (!attendanceError) {
      const { error: resError } = await supabase
        .from('reservations')
        .update({ status })
        .eq('id', attendanceModal.reservationId)

      if (!resError) {
        const mapKey = `${attendanceModal.date}|${attendanceModal.time}`
        setLocalStatuses(prev => ({ ...prev, [mapKey]: status }))
      }
    }

    setAttendanceLoading(false)
    setAttendanceModal(null)
  }

  const getSlotStatus = (dayKey: string, slot: string) => {
    const mapKey = `${dayKey}|${slot}`
    const reservation = reservations[mapKey]
    if (!reservation) return null
    return localStatuses[mapKey] ?? reservation.status
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-7">
        {days.map((day) => {
          const dayKey = day.key
          const isToday = day.isToday
          const slots = SLOTS

          return (
            <div
              key={dayKey}
              className={`rounded-lg bg-gray-800 p-3 ${isToday ? "ring-2 ring-blue-500" : ""}`}
            >
              <h2 className="mb-3 text-xs font-semibold text-gray-200">
                {formatDayLabel(dayKey, isToday)}
              </h2>
              <ul className="space-y-1">
                {slots.map((slot) => {
                  const mapKey = `${dayKey}|${slot}`
                  const reservation = reservations[mapKey]
                  const isClosed = closed.has(mapKey)
                  const isLoading = loading === mapKey
                  const slotStatus = getSlotStatus(dayKey, slot)

                  if (reservation) {
                    const isDone = slotStatus === 'completed' || slotStatus === 'no_show'
                    return (
                      <li key={slot}>
                        <button
                          onClick={() => openAttendance(dayKey, slot)}
                          disabled={isDone}
                          className={`w-full rounded px-2 py-2 text-left transition-colors ${
                            slotStatus === 'completed' ? 'bg-green-900/40 cursor-default' :
                            slotStatus === 'no_show' ? 'bg-red-900/40 cursor-default' :
                            'bg-red-900/40 hover:bg-red-800/60 cursor-pointer'
                          }`}
                        >
                          <p className="text-xs font-medium text-white">{slot.substring(0, 5)}</p>
                          <p className="text-xs text-gray-200">{reservation.member_name}</p>
                          <p className="text-xs text-gray-400">{STATUS_LABELS[slotStatus ?? reservation.status]}</p>
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
                          className="w-full rounded bg-gray-700 px-2 py-2 text-left opacity-40 hover:opacity-60 transition-opacity"
                        >
                          <p className="text-xs font-medium text-gray-400">{slot.substring(0, 5)}</p>
                          <p className="text-xs text-gray-500">{isLoading ? "..." : "Kapalı"}</p>
                        </button>
                      </li>
                    )
                  }

                  return (
                    <li key={slot}>
                      <button
                        onClick={() => toggle(dayKey, slot)}
                        disabled={!!loading}
                        className="w-full rounded bg-gray-700/80 px-2 py-2 text-left hover:bg-gray-700 transition-colors"
                      >
                        <p className="text-xs font-medium text-white">{slot.substring(0, 5)}</p>
                        <p className="text-xs text-green-400">{isLoading ? "..." : "Müsait"}</p>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>

      {attendanceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-white mb-2">Ders Durumu</h3>
            <p className="text-gray-300 mb-1">{attendanceModal.memberName}</p>
            <p className="text-gray-400 text-sm mb-6">
              {attendanceModal.date} — {attendanceModal.time.substring(0, 5)}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => markAttendance('completed')}
                disabled={attendanceLoading}
                className="flex-1 bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Tamamlandı
              </button>
              <button
                onClick={() => markAttendance('no_show')}
                disabled={attendanceLoading}
                className="flex-1 bg-red-600 text-white font-bold py-3 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Gelmedi
              </button>
            </div>
            <button
              onClick={() => setAttendanceModal(null)}
              className="w-full mt-3 text-gray-400 hover:text-white text-sm py-2"
            >
              İptal
            </button>
          </div>
        </div>
      )}
    </>
  )
}