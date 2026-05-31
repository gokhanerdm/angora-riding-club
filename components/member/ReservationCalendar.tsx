'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface TimeSlot {
  trainer_id: string
  trainer_name: string
  slot_time: string
  is_available: boolean
}

const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default function ReservationCalendar() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState('')
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  // Max 4 ay ileri, her ay başında bir yeni ay açılır
  const maxMonth = (today.getMonth() + 3) % 12
  const maxYear = today.getFullYear() + Math.floor((today.getMonth() + 3) / 12)

  const isAtMin = viewYear === today.getFullYear() && viewMonth <= today.getMonth()
  const isAtMax = viewYear === maxYear && viewMonth >= maxMonth

  const prevMonth = () => {
    if (isAtMin) return
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }

  const nextMonth = () => {
    if (isAtMax) return
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const firstDay = new Date(viewYear, viewMonth, 1)
  const lastDay = new Date(viewYear, viewMonth + 1, 0)
  const startDow = (firstDay.getDay() + 6) % 7
  const days: (number | null)[] = []
  for (let i = 0; i < startDow; i++) days.push(null)
  for (let i = 1; i <= lastDay.getDate(); i++) days.push(i)

  const handleSelect = async (dateStr: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: memberData } = await supabase
      .from('members').select('id').eq('user_id', user.id).single()

    if (memberData) {
      const { data: memberships } = await supabase
        .from('memberships')
        .select('id, total_lessons, used_lessons, reserved_lessons')
        .eq('member_id', memberData.id)
        .eq('is_current', true)

      const remaining = (memberships ?? []).reduce((sum, m) =>
        sum + (m.total_lessons - m.used_lessons - m.reserved_lessons), 0)

      if (remaining <= 0) {
        window.location.href = '/member/packages'
        return
      }
    }

    setSelectedDate(dateStr)
    setModalOpen(true)
    setLoading(true)
    setSlots([])

    const { data, error } = await supabase.rpc('get_available_slots', {
      user_id: user.id,
      selected_date: dateStr
    })

    if (error) console.error('Slots error:', error)
    else setSlots(data || [])
    setLoading(false)
  }

  const handleReservation = async (slot: TimeSlot) => {
    if (!confirm(`${slot.slot_time.substring(0, 5)} saatinde rezervasyon yapmak istiyor musunuz?`)) return

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const endTime = new Date(`2000-01-01T${slot.slot_time}`)
    endTime.setMinutes(endTime.getMinutes() + 30)

    const { error } = await supabase.rpc('create_reservation', {
      user_id: user.id,
      p_trainer_id: slot.trainer_id,
      p_scheduled_date: selectedDate,
      p_start_time: slot.slot_time,
      p_end_time: endTime.toTimeString().substring(0, 8),
      p_reservation_type: 'general'
    })

    if (error) alert('Rezervasyon yapılamadı: ' + error.message)
    else { alert('Rezervasyon başarılı!'); setModalOpen(false) }
  }

  return (
    <div className="pb-8">
      <div className="flex items-center justify-between mb-5 px-3">
        <button
          onClick={prevMonth}
          disabled={isAtMin}
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-bold disabled:opacity-20 transition-opacity"
          style={{ background: 'rgba(255,255,255,0.06)', color: '#7b93c4', border: '1px solid rgba(255,255,255,0.08)' }}
        >←</button>
        <span className="text-lg font-bold text-white">{MONTHS[viewMonth]} {viewYear}</span>
        <button
          onClick={nextMonth}
          disabled={isAtMax}
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-bold disabled:opacity-20 transition-opacity"
          style={{ background: 'rgba(255,255,255,0.06)', color: '#7b93c4', border: '1px solid rgba(255,255,255,0.08)' }}
        >→</button>
      </div>

      <div className="grid grid-cols-7 mb-2 px-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-xs font-bold uppercase tracking-wide" style={{ color: '#4a6190' }}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1 px-1">
        {days.map((day, i) => {
          if (!day) return <div key={i} />
          const date = new Date(viewYear, viewMonth, day)
          const past = date < today
          const dateStr = toDateStr(date)
          const sel = dateStr === selectedDate
          const isToday = dateStr === toDateStr(today)

          return (
            <button
              key={i}
              disabled={past}
              onClick={() => handleSelect(dateStr)}
              className="flex items-center justify-center mx-auto transition-all"
              style={{
                width: 40, height: 40, borderRadius: 12,
                fontSize: 15,
                fontWeight: sel || isToday ? 700 : 500,
                color: past ? 'rgba(74,97,144,0.4)' : sel ? '#0a0f2e' : isToday ? '#f59e0b' : '#c8d6f0',
                background: sel ? '#fff' : isToday ? 'rgba(245,158,11,0.12)' : 'transparent',
                border: isToday && !sel ? '1px solid rgba(245,158,11,0.4)' : 'none',
                cursor: past ? 'default' : 'pointer',
              }}
            >
              {day}
            </button>
          )
        })}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div
            className="w-full rounded-t-3xl flex flex-col"
            style={{ background: '#0d1b4b', maxHeight: '60vh', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <div
              className="flex justify-between items-center px-5 py-4"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
            >
              <h3 className="text-base font-bold text-white">
                {selectedDate && (() => {
                  const [y, m, d] = selectedDate.split('-')
                  return `${parseInt(d)} ${MONTHS[parseInt(m) - 1]} ${y}`
                })()}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-lg font-bold"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#7b93c4' }}
              >✕</button>
            </div>

            <div className="overflow-y-auto flex-1 px-4 py-4">
              {loading && <p className="text-center py-8 text-sm" style={{ color: '#7b93c4' }}>Yükleniyor...</p>}
              {!loading && slots.length === 0 && (
                <p className="text-center py-8 text-sm" style={{ color: '#7b93c4' }}>Bu tarihte müsait ders bulunamadı.</p>
              )}
              {!loading && slots.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {slots.map((slot, index) => (
                    <button
                      key={index}
                      disabled={!slot.is_available}
                      onClick={() => handleReservation(slot)}
                      className="py-3.5 rounded-2xl text-sm font-bold transition-all"
                      style={slot.is_available
                        ? { background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }
                        : { background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.05)', cursor: 'not-allowed' }
                      }
                    >
                      {slot.slot_time.substring(0, 5)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
