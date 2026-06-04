'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface TimeSlot {
  trainer_id:   string
  trainer_name: string
  slot_time:    string
  is_available: boolean
  slot_status:  'available' | 'own_reservation' | 'closed' | 'reserved' | 'past'
}

const DAYS   = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']
const MONTHS_SHORT = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

function slotEnd(slotTime: string): string {
  const [h, m] = slotTime.substring(0, 5).split(':').map(Number)
  const total  = h * 60 + m + 30
  return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`
}

function formatDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return `${d} ${MONTHS[m - 1]} ${y} ${DAYS[(date.getDay() + 6) % 7]}`
}

export default function ReservationCalendar({ overrideUserId }: { overrideUserId?: string }) {
  const router  = useRouter()
  const today   = new Date()
  today.setHours(0, 0, 0, 0)

  const [viewYear, setViewYear]   = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState('')
  const [slots, setSlots]         = useState<TimeSlot[]>([])
  const [loading, setLoading]     = useState(false)
  const [isWeekdayPkg, setIsWeekdayPkg] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const uid = overrideUserId ?? user.id
      supabase.from('members').select('id').eq('user_id', uid).single().then(({ data: m }) => {
        if (!m) return
        supabase.from('memberships').select('type').eq('member_id', m.id)
          .order('created_at', { ascending: false }).limit(1).single().then(({ data: ms }) => {
          setIsWeekdayPkg(ms?.type === 'weekday')
        })
      })
    })
  }, [overrideUserId])
  const [modalOpen, setModalOpen] = useState(false)

  // Rezervasyon onay state
  const [confirmSlot, setConfirmSlot]   = useState<TimeSlot | null>(null)
  const [bookingState, setBookingState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [bookingMsg, setBookingMsg]     = useState('')

  const maxMonth = (today.getMonth() + 3) % 12
  const maxYear  = today.getFullYear() + Math.floor((today.getMonth() + 3) / 12)
  const isAdmin  = !!overrideUserId
  const isAtMin  = !isAdmin && viewYear === today.getFullYear() && viewMonth <= today.getMonth()
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

  // Hafta içi paketi için Cmt/Paz kontrolü (isWeekdayPkg prop'u yoksa API'den gelir)
  const isWeekend = (date: Date) => { const d = date.getDay(); return d === 0 || d === 6 }

  const handleSelectDate = async (dateStr: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // overrideUserId varsa (admin üye adına bakıyor) onu kullan
    const effectiveUserId = overrideUserId ?? user.id

    // Ders hakkı kontrolü (admin görüntülüyorsa atla)
    if (!overrideUserId) {
      const { data: memberData } = await supabase
        .from('members').select('id').eq('user_id', effectiveUserId).single()
      if (memberData) {
        const { data: memberships } = await supabase
          .from('memberships')
          .select('total_lessons, used_lessons, reserved_lessons')
          .eq('member_id', memberData.id).eq('is_current', true)
        const remaining = (memberships ?? []).reduce(
          (sum, m) => sum + (m.total_lessons - m.used_lessons - m.reserved_lessons), 0
        )
        if (remaining <= 0) { router.push('/member/packages'); return }
      }
    }

    setSelectedDate(dateStr)
    setModalOpen(true)
    setLoading(true)
    setSlots([])
    setBookingState('idle')
    setBookingMsg('')
    setConfirmSlot(null)

    const { data, error } = await supabase.rpc('get_available_slots', {
      user_id: effectiveUserId, selected_date: dateStr
    })
    if (!error) setSlots((data ?? []).filter((s: TimeSlot) => isAdmin || s.slot_status !== 'past'))
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

    const effectiveUserId = overrideUserId ?? user.id
    const endTime = slotEnd(confirmSlot.slot_time)

    const { error } = await supabase.rpc('create_reservation', {
      user_id:            effectiveUserId,
      p_trainer_id:       confirmSlot.trainer_id,
      p_scheduled_date:   selectedDate,
      p_start_time:       confirmSlot.slot_time,
      p_end_time:         endTime + ':00',
      p_reservation_type: 'general',
    })

    if (error) {
      setBookingState('error')
      setBookingMsg(error.message)
    } else {
      setBookingState('success')
      setBookingMsg(`${confirmSlot.slot_time.substring(0,5)} rezervasyonunuz alındı!`)
      setConfirmSlot(null)
      // Slot listesini güncelle
      const { data: { user: u } } = await supabase.auth.getUser()
      if (u) {
        const { data } = await supabase.rpc('get_available_slots', {
          user_id: overrideUserId ?? u.id, selected_date: selectedDate
        })
        if (data) setSlots((data as TimeSlot[]).filter(s => isAdmin || s.slot_status !== 'past'))
      }
      router.refresh()
    }
  }

  // Slot görsel
  const slotStyle = (status: TimeSlot['slot_status']) => {
    switch (status) {
      case 'available':
        return {
          bg:     'rgba(52,211,153,0.10)',
          border: '1px solid rgba(52,211,153,0.25)',
          color:  '#34d399',
          label:  'Müsait',
        }
      case 'own_reservation':
        return {
          bg:     'rgba(245,158,11,0.12)',
          border: '1px solid rgba(245,158,11,0.35)',
          color:  '#f59e0b',
          label:  'Rezervasyonunuz',
        }
      case 'reserved':
        return {
          bg:     'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          color:  '#4a6190',
          label:  'Dolu',
        }
      case 'closed':
        return {
          bg:     'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.04)',
          color:  '#2d3a55',
          label:  'Kapalı',
        }
      default:
        return { bg: 'transparent', border: 'none', color: '#4a6190', label: '' }
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
          style={{ background: 'rgba(255,255,255,0.06)', color: '#7b93c4', border: '1px solid rgba(255,255,255,0.08)' }}
        >←</button>
        <span className="text-lg font-bold text-white">{MONTHS[viewMonth]} {viewYear}</span>
        <button
          onClick={nextMonth}
          disabled={isAtMax}
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-bold disabled:opacity-20"
          style={{ background: 'rgba(255,255,255,0.06)', color: '#7b93c4', border: '1px solid rgba(255,255,255,0.08)' }}
        >→</button>
      </div>

      {/* Gün başlıkları */}
      <div className="grid grid-cols-7 mb-2 px-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-xs font-bold uppercase tracking-wide" style={{ color: '#4a6190' }}>{d}</div>
        ))}
      </div>

      {/* Takvim */}
      <div className="grid grid-cols-7 gap-y-1 px-1">
        {days.map((day, i) => {
          if (!day) return <div key={i} />
          const date     = new Date(viewYear, viewMonth, day)
          const past     = date < today
          const blocked  = !isAdmin && isWeekdayPkg && isWeekend(date)
          const dateStr  = toDateStr(date)
          const sel      = dateStr === selectedDate
          const isToday  = dateStr === toDateStr(today)
          return (
            <button
              key={i}
              disabled={(!isAdmin && past) || blocked}
              onClick={() => handleSelectDate(dateStr)}
              className="flex items-center justify-center mx-auto transition-all"
              style={{
                width: 40, height: 40, borderRadius: 12,
                fontSize: 15,
                fontWeight: sel || isToday ? 700 : 500,
                color:   ((!isAdmin && past) || blocked) ? 'rgba(74,97,144,0.4)' : sel ? '#0a0f2e' : isToday ? '#f59e0b' : '#c8d6f0',
                background: sel ? '#fff' : isToday ? 'rgba(245,158,11,0.12)' : 'transparent',
                border: isToday && !sel ? '1px solid rgba(245,158,11,0.4)' : 'none',
                cursor: past ? 'default' : 'pointer',
              }}
            >{day}</button>
          )
        })}
      </div>

      {/* Slot modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div
            className="w-full rounded-t-3xl flex flex-col"
            style={{ background: '#0d1b4b', maxHeight: '70vh', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {/* Modal header */}
            <div className="flex justify-between items-center px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div>
                <h3 className="text-base font-bold text-white">
                  {selectedDate && formatDisplayDate(selectedDate)}
                </h3>
                {slots.length > 0 && (
                  <p className="text-xs mt-0.5" style={{ color: '#7b93c4' }}>{slots[0].trainer_name}</p>
                )}
              </div>
              <button
                onClick={() => { setModalOpen(false); setConfirmSlot(null) }}
                className="w-8 h-8 flex items-center justify-center rounded-full text-lg font-bold"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#7b93c4' }}
              >✕</button>
            </div>

            <div className="overflow-y-auto flex-1 px-4 py-4">
              {/* Feedback mesajları */}
              {bookingState === 'success' && (
                <div className="mb-3 px-4 py-3 rounded-2xl text-sm font-bold text-center"
                  style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>
                  ✓ {bookingMsg}
                </div>
              )}
              {bookingState === 'error' && (
                <div className="mb-3 px-4 py-3 rounded-2xl text-sm text-center"
                  style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}>
                  {bookingMsg}
                </div>
              )}

              {loading && <p className="text-center py-8 text-sm" style={{ color: '#7b93c4' }}>Yükleniyor...</p>}

              {!loading && slots.length === 0 && (
                <p className="text-center py-8 text-sm" style={{ color: '#7b93c4' }}>Bu tarihte müsait ders bulunamadı.</p>
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
                        <p className="text-sm font-bold text-white">
                          {slot.slot_time.substring(0,5)} – {slotEnd(slot.slot_time)}
                        </p>
                        <p className="text-xs font-bold mt-0.5" style={{ color: st.color }}>{st.label}</p>
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
        <div className="fixed inset-0 z-[60] flex items-end" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div
            className="w-full rounded-t-3xl p-6"
            style={{ background: '#0d1b4b', border: '1px solid rgba(255,255,255,0.10)' }}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'rgba(255,255,255,0.15)' }} />
            <h3 className="text-lg font-bold text-white mb-4">Rezervasyon Onayla</h3>

            <div className="rounded-2xl p-4 mb-5 space-y-2" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-3">
                <span className="text-xl">📅</span>
                <span className="text-sm font-bold text-white">{formatDisplayDate(selectedDate)}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xl">⏰</span>
                <span className="text-sm font-bold text-white">
                  {confirmSlot.slot_time.substring(0,5)} – {slotEnd(confirmSlot.slot_time)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xl">👤</span>
                <span className="text-sm font-bold text-white">{confirmSlot.trainer_name}</span>
              </div>
            </div>

            <p className="text-sm mb-6 text-center" style={{ color: '#7b93c4' }}>
              Bu dersi rezerve etmek istiyor musunuz?
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmSlot(null)}
                className="flex-1 py-3 rounded-2xl font-bold text-sm"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#7b93c4' }}
              >
                Vazgeç
              </button>
              <button
                onClick={handleConfirmBooking}
                disabled={bookingState === 'loading'}
                className="flex-1 py-3 rounded-2xl font-bold text-sm disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff' }}
              >
                {bookingState === 'loading' ? 'Rezervasyon yapılıyor...' : 'Rezervasyon Yap'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
