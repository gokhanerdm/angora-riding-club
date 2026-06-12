'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface TimeSlot {
  trainer_id:   string
  trainer_name: string
  slot_time:    string
  is_available: boolean
  slot_status:  'available' | 'closed' | 'reserved' | 'past'
}

const BG = '#FBFBFB'
const GREEN = '#1B3B2F'
const GREEN_SOFT = '#E8F0EA'
const MUTED = '#6B7280'

const DAYS   = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

function slotEnd15(slotTime: string): string {
  const [h, m] = slotTime.substring(0, 5).split(':').map(Number)
  const total  = h * 60 + m + 15
  return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`
}

function formatDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return `${d} ${MONTHS[m - 1]} ${y} ${DAYS[(date.getDay() + 6) % 7]}`
}

const SLOT_LABELS: Record<TimeSlot['slot_status'], string> = {
  available: 'Müsait',
  reserved:  'Dolu',
  closed:    'Kapalı',
  past:      'Geçmiş',
}

export default function TrialLessonCalendar() {
  const router  = useRouter()
  const today   = new Date()
  today.setHours(0, 0, 0, 0)

  const [viewYear, setViewYear]   = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState('')
  const [slots, setSlots]         = useState<TimeSlot[]>([])
  const [loading, setLoading]     = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  const [confirmSlot, setConfirmSlot]   = useState<TimeSlot | null>(null)
  const [bookingState, setBookingState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [bookingMsg, setBookingMsg]     = useState('')

  const maxMonth = (today.getMonth() + 2) % 12
  const maxYear  = today.getFullYear() + Math.floor((today.getMonth() + 2) / 12)
  const isAtMin  = viewYear === today.getFullYear() && viewMonth <= today.getMonth()
  const isAtMax  = viewYear === maxYear && viewMonth >= maxMonth

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

  const firstDay  = new Date(viewYear, viewMonth, 1)
  const lastDay   = new Date(viewYear, viewMonth + 1, 0)
  const startDow  = (firstDay.getDay() + 6) % 7
  const days: (number | null)[] = []
  for (let i = 0; i < startDow; i++) days.push(null)
  for (let i = 1; i <= lastDay.getDate(); i++) days.push(i)

  const handleSelectDate = async (dateStr: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setSelectedDate(dateStr)
    setModalOpen(true)
    setLoading(true)
    setSlots([])
    setBookingState('idle')
    setBookingMsg('')
    setConfirmSlot(null)

    const { data, error } = await supabase.rpc('get_trial_slots', {
      p_user_id: user.id, p_selected_date: dateStr
    })
    if (!error) setSlots((data ?? []).filter((s: TimeSlot) => s.slot_status !== 'past'))
    setLoading(false)
  }

  const handleSlotClick = (slot: TimeSlot) => {
    if (slot.slot_status !== 'available') return
    setConfirmSlot(slot)
    setBookingState('idle')
    setBookingMsg('')
  }

  const handleConfirmBooking = async () => {
    if (!confirmSlot) return
    setBookingState('loading')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.rpc('create_trial_reservation', {
      p_user_id:        user.id,
      p_scheduled_date: selectedDate,
      p_start_time:     confirmSlot.slot_time,
    })

    if (error) {
      setBookingState('error')
      setBookingMsg(error.message)
    } else {
      setBookingState('success')
      setBookingMsg(`${confirmSlot.slot_time.substring(0,5)} – ${slotEnd15(confirmSlot.slot_time)} deneme dersiniz alındı ✓`)
      setConfirmSlot(null)
      setTimeout(() => router.push('/member'), 1500)
    }
  }

  const slotStyle = (status: TimeSlot['slot_status']) => {
    switch (status) {
      case 'available':
        return { bg: 'rgba(27,59,47,0.06)', border: '1px solid rgba(27,59,47,0.15)', color: GREEN }
      case 'reserved':
        return { bg: GREEN_SOFT, border: '1px solid rgba(27,59,47,0.06)', color: MUTED }
      case 'closed':
        return { bg: GREEN_SOFT, border: '1px solid rgba(27,59,47,0.04)', color: MUTED }
      default:
        return { bg: 'transparent', border: 'none', color: MUTED }
    }
  }

  return (
    <div className="pb-8">
      {/* Ay navigasyonu */}
      <div className="flex items-center justify-between mb-5 px-3">
        <button
          onClick={prevMonth}
          disabled={isAtMin}
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-bold disabled:opacity-20"
          style={{ background: GREEN_SOFT, color: MUTED, border: '1px solid rgba(27,59,47,0.08)' }}
        >←</button>
        <span className="text-lg font-bold" style={{ color: GREEN }}>{MONTHS[viewMonth]} {viewYear}</span>
        <button
          onClick={nextMonth}
          disabled={isAtMax}
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-bold disabled:opacity-20"
          style={{ background: GREEN_SOFT, color: MUTED, border: '1px solid rgba(27,59,47,0.08)' }}
        >→</button>
      </div>

      {/* Gün başlıkları */}
      <div className="grid grid-cols-7 mb-2 px-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-xs font-bold uppercase tracking-wide" style={{ color: MUTED }}>{d}</div>
        ))}
      </div>

      {/* Takvim */}
      <div className="grid grid-cols-7 gap-y-1 px-1">
        {days.map((day, i) => {
          if (!day) return <div key={i} />
          const date     = new Date(viewYear, viewMonth, day)
          const past     = date < today
          const dateStr  = toDateStr(date)
          const sel      = dateStr === selectedDate
          const isToday  = dateStr === toDateStr(today)
          return (
            <button
              key={i}
              disabled={past}
              onClick={() => handleSelectDate(dateStr)}
              className="flex items-center justify-center mx-auto transition-all"
              style={{
                width: 40, height: 40, borderRadius: 12,
                fontSize: 15,
                fontWeight: sel || isToday ? 700 : 500,
                color:   past ? 'rgba(107,114,128,0.4)' : sel ? '#fff' : isToday ? '#f59e0b' : GREEN,
                background: sel ? GREEN : isToday ? 'rgba(245,158,11,0.12)' : 'transparent',
                border: isToday && !sel ? '1px solid rgba(245,158,11,0.4)' : 'none',
                cursor: past ? 'default' : 'pointer',
              }}
            >{day}</button>
          )
        })}
      </div>

      {/* Slot modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div
            className="w-full rounded-t-3xl flex flex-col"
            style={{ background: '#fff', maxHeight: '70vh', border: '1px solid rgba(27,59,47,0.10)' }}
          >
            <div className="flex justify-between items-center px-5 py-4" style={{ borderBottom: '1px solid rgba(27,59,47,0.08)' }}>
              <div>
                <h3 className="text-base font-bold" style={{ color: GREEN }}>
                  {selectedDate && formatDisplayDate(selectedDate)}
                </h3>
                {slots.length > 0 && (
                  <p className="text-xs mt-0.5" style={{ color: MUTED }}>{slots[0].trainer_name}</p>
                )}
              </div>
              <button
                onClick={() => { setModalOpen(false); setConfirmSlot(null) }}
                className="w-8 h-8 flex items-center justify-center rounded-full text-lg font-bold"
                style={{ background: GREEN_SOFT, color: MUTED }}
              >✕</button>
            </div>

            <div className="overflow-y-auto flex-1 px-4 py-4">
              {bookingState === 'success' && (
                <div className="mb-3 px-4 py-3 rounded-2xl text-sm font-bold text-center"
                  style={{ background: 'rgba(52,211,153,0.12)', color: '#15803d', border: '1px solid rgba(52,211,153,0.3)' }}>
                  ✓ {bookingMsg}
                </div>
              )}
              {bookingState === 'error' && (
                <div className="mb-3 px-4 py-3 rounded-2xl text-sm text-center"
                  style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}>
                  {bookingMsg}
                </div>
              )}

              {loading && <p className="text-center py-8 text-sm" style={{ color: MUTED }}>Yükleniyor...</p>}

              {!loading && slots.length === 0 && (
                <p className="text-center py-8 text-sm" style={{ color: MUTED }}>Bu tarihte müsait ders bulunamadı.</p>
              )}

              {!loading && slots.length > 0 && (
                <div className="grid grid-cols-3 gap-1.5">
                  {slots.map((slot, idx) => {
                    const st = slotStyle(slot.slot_status)
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSlotClick(slot)}
                        disabled={slot.slot_status !== 'available' || bookingState === 'loading'}
                        className="rounded-xl py-2 px-2 text-left transition-opacity disabled:cursor-default active:opacity-70"
                        style={{ background: st.bg, border: st.border }}
                      >
                        <p className="text-sm font-bold" style={{ color: GREEN }}>
                          {slot.slot_time.substring(0,5)} – {slotEnd15(slot.slot_time)}
                        </p>
                        <p className="text-xs font-bold mt-0.5" style={{ color: st.color }}>{SLOT_LABELS[slot.slot_status]}</p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rezervasyon onay bottom-sheet */}
      {confirmSlot && (
        <div className="fixed inset-0 z-[60] flex items-end" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div
            className="w-full rounded-t-3xl p-6"
            style={{ background: '#fff', border: '1px solid rgba(27,59,47,0.10)' }}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: GREEN_SOFT }} />
            <h3 className="text-lg font-bold mb-4" style={{ color: GREEN }}>Deneme Dersi Al</h3>

            <div className="rounded-2xl p-4 mb-5 space-y-2" style={{ background: GREEN_SOFT, border: '1px solid rgba(27,59,47,0.08)' }}>
              <div className="flex items-center gap-3">
                <span className="text-xl">📅</span>
                <span className="text-sm font-bold" style={{ color: GREEN }}>{formatDisplayDate(selectedDate)}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xl">⏰</span>
                <span className="text-sm font-bold" style={{ color: GREEN }}>
                  {confirmSlot.slot_time.substring(0,5)} – {slotEnd15(confirmSlot.slot_time)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xl">👤</span>
                <span className="text-sm font-bold" style={{ color: GREEN }}>{confirmSlot.trainer_name}</span>
              </div>
            </div>

            <p className="text-sm mb-6 text-center" style={{ color: MUTED }}>
              Bu ücretsiz deneme dersini almak istiyor musunuz? Bu hakkı bir kez kullanabilirsiniz.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmSlot(null)}
                className="flex-1 py-3 rounded-2xl font-bold text-sm"
                style={{ background: GREEN_SOFT, color: MUTED }}
              >
                Vazgeç
              </button>
              <button
                onClick={handleConfirmBooking}
                disabled={bookingState === 'loading'}
                className="flex-1 py-3 rounded-2xl font-bold text-sm disabled:opacity-50"
                style={{ background: '#f59e0b', color: GREEN }}
              >
                {bookingState === 'loading' ? 'Alınıyor...' : 'Dersi Al'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
