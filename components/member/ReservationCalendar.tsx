'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isSlotPast, isDatePast } from '@/lib/lessons/time'

interface TimeSlot {
  trainer_id:   string
  trainer_name: string
  slot_time:    string
  is_available: boolean
  slot_status:  'available' | 'own_reservation' | 'own_completed' | 'own_no_show' | 'closed' | 'reserved' | 'past'
}

const GREEN = '#1B3B2F'
const GREEN_SOFT = '#E8F0EA'
const MUTED = '#6B7280'

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
  const [pastSlot, setPastSlot]   = useState<TimeSlot | null>(null)
  const [pastSaving, setPastSaving] = useState(false)
  const [reservedDates, setReservedDates]     = useState<Set<string>>(new Set())
  const [pastReservedDates, setPastReservedDates] = useState<Set<string>>(new Set())

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const uid = overrideUserId ?? user.id
      supabase.from('members').select('id').eq('user_id', uid).single().then(async ({ data: m }) => {
        if (!m) return
        const { data: ms } = await supabase.from('memberships').select('type, family_id, created_at')
          .eq('member_id', m.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
        if (ms) { setIsWeekdayPkg(ms.type === 'weekday'); return }
        // Kendi paketi yoksa aile paketine bak (paylaşılan havuzdan faydalanan üyeler için)
        const { data: fm } = await supabase.from('family_members').select('family_id').eq('member_id', m.id).limit(1)
        if (fm && fm.length > 0) {
          const { data: famMs } = await supabase.from('memberships').select('type')
            .eq('family_id', fm[0].family_id).eq('is_current', true)
            .order('created_at', { ascending: false }).limit(1).maybeSingle()
          setIsWeekdayPkg(famMs?.type === 'weekday')
        }
      })
    })
  }, [overrideUserId])
  // Ayda kayıtlı (iptal/gelmedi hariç) dersi olan günler — mavi kutu ile işaretlenir
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const uid = overrideUserId ?? user.id
      const { data: m } = await supabase.from('members').select('id').eq('user_id', uid).single()
      if (!m) return
      const monthStart = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-01`
      const monthEnd   = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(new Date(viewYear, viewMonth + 1, 0).getDate()).padStart(2, '0')}`
      const { data: res } = await supabase.from('reservations')
        .select('scheduled_date, start_time')
        .eq('member_id', m.id)
        .in('status', ['pending', 'approved', 'completed'])
        .gte('scheduled_date', monthStart)
        .lte('scheduled_date', monthEnd)

      const future = new Set<string>()
      const past   = new Set<string>()
      for (const r of res ?? []) {
        if (isSlotPast(r.scheduled_date, r.start_time)) past.add(r.scheduled_date)
        else future.add(r.scheduled_date)
      }
      setReservedDates(future)
      setPastReservedDates(past)
    })
  }, [overrideUserId, viewYear, viewMonth])

  const [modalOpen, setModalOpen] = useState(false)

  // Rezervasyon onay state
  const [confirmSlot, setConfirmSlot]   = useState<TimeSlot | null>(null)
  const [bookingState, setBookingState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [bookingMsg, setBookingMsg]     = useState('')

  // Slot aç/kapat (admin)
  const [toggleSlot,   setToggleSlot]   = useState<TimeSlot | null>(null)
  const [toggleSaving, setToggleSaving] = useState(false)

  const handleToggleSlot = async () => {
    if (!toggleSlot || !selectedDate) return
    setToggleSaving(true)
    const supabase = createClient()
    if (toggleSlot.slot_status === 'closed') {
      await supabase.from('trainer_schedules')
        .delete()
        .eq('trainer_id', toggleSlot.trainer_id)
        .eq('scheduled_date', selectedDate)
        .eq('start_time', toggleSlot.slot_time)
        .eq('is_available', false)
    } else {
      const endTime = slotEnd(toggleSlot.slot_time) + ':00'
      await supabase.from('trainer_schedules').insert({
        trainer_id:     toggleSlot.trainer_id,
        scheduled_date: selectedDate,
        start_time:     toggleSlot.slot_time,
        end_time:       endTime,
        is_available:   false,
      })
    }
    setToggleSaving(false)
    setToggleSlot(null)
    const { data } = await supabase.rpc('get_available_slots', { user_id: overrideUserId, selected_date: selectedDate })
    if (data) setSlots((data as TimeSlot[]).filter(s => isAdmin || s.slot_status !== 'past'))
  }

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

    // Ders hakkı kontrolü (admin görüntülüyorsa atla) — aile havuzunu da kapsayan RPC kullanılır
    if (!overrideUserId) {
      const { data: stats } = await supabase
        .rpc('member_dashboard_stats', { user_id: effectiveUserId })
      const remaining = stats?.[0]?.remaining_lessons ?? 0
      if (remaining <= 0) { router.push('/member/packages'); return }
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
    const slotIsPast = isSlotPast(selectedDate, slot.slot_time)

    // Admin + geçmiş slot + boş → Tamamlandı/Gelmedi seçimi
    if (isAdmin && slotIsPast && (slot.slot_status === 'available' || slot.slot_status === 'past')) {
      setPastSlot(slot)
      return
    }

    // Tıklanamaz
    if (slot.slot_status !== 'available') return

    setConfirmSlot(slot)
    setBookingState('idle')
    setBookingMsg('')
  }

  const savePastLesson = async (status: 'completed' | 'no_show') => {
    if (!pastSlot || !overrideUserId) return
    setPastSaving(true)
    const supabase = createClient()
    const { data: memberRow } = await supabase.from('members')
      .select('id').eq('user_id', overrideUserId).single()
    if (!memberRow) { setPastSaving(false); return }
    const endTime = slotEnd(pastSlot.slot_time)
    const { error } = await supabase.rpc('trainer_create_reservation', {
      p_member_id:      memberRow.id,
      p_trainer_id:     pastSlot.trainer_id,
      p_scheduled_date: selectedDate,
      p_start_time:     pastSlot.slot_time,
      p_end_time:       endTime + ':00',
    })
    if (!error) {
      // Oluşan rezervasyonu direkt status'a çek
      const { data: newRes } = await supabase.from('reservations')
        .select('id').eq('member_id', memberRow.id).eq('scheduled_date', selectedDate)
        .eq('start_time', pastSlot.slot_time).eq('status', 'completed').maybeSingle()
      if (newRes && status === 'no_show') {
        await supabase.rpc('mark_attendance', { p_reservation_id: newRes.id, p_status: 'no_show', p_marked_by: memberRow.id })
      }
      setBookingState('success')
      setBookingMsg(status === 'completed' ? `${pastSlot.slot_time.substring(0,5)} tamamlandı ✓` : `${pastSlot.slot_time.substring(0,5)} gelmedi ✓`)
      const { data } = await supabase.rpc('get_available_slots', { user_id: overrideUserId, selected_date: selectedDate })
      if (data) setSlots((data as TimeSlot[]).filter(s => isAdmin || s.slot_status !== 'past'))
    }
    setPastSlot(null)
    setPastSaving(false)
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
      setBookingMsg(`${confirmSlot.slot_time.substring(0,5)} dersiniz alındı ✓`)
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
          label:  'Alınan Ders',
        }
      case 'own_completed':
        return {
          bg:     'rgba(52,211,153,0.10)',
          border: '1px solid rgba(52,211,153,0.30)',
          color:  '#34d399',
          label:  'Tamamlandı',
        }
      case 'own_no_show':
        return {
          bg:     'rgba(248,113,113,0.10)',
          border: '1px solid rgba(248,113,113,0.25)',
          color:  '#f87171',
          label:  'Gelmedi',
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
      case 'past':
        return {
          bg:     'rgba(52,211,153,0.07)',
          border: '1px solid rgba(52,211,153,0.18)',
          color:  '#34d399',
          label:  'Geçmiş / Ekle',
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
          const blocked  = !isAdmin && isWeekdayPkg && isWeekend(date)
          const dateStr  = toDateStr(date)
          const sel      = dateStr === selectedDate
          const isToday  = dateStr === toDateStr(today)
          const hasFutureLesson = reservedDates.has(dateStr)
          const hasPastLesson   = pastReservedDates.has(dateStr)
          return (
            <button
              key={i}
              disabled={(!isAdmin && past) || blocked}
              onClick={() => handleSelectDate(dateStr)}
              className="flex items-center justify-center mx-auto transition-all"
              style={{
                width: 40, height: 40, borderRadius: 12,
                fontSize: 15,
                fontWeight: sel || isToday || hasFutureLesson || hasPastLesson ? 700 : 500,
                color:   ((!isAdmin && past) || blocked) ? 'rgba(107,114,128,0.4)' : sel ? '#fff' : hasFutureLesson ? '#38bdf8' : isToday ? '#f59e0b' : hasPastLesson ? '#c9a978' : GREEN,
                background: sel ? GREEN : hasFutureLesson ? 'rgba(56,189,248,0.15)' : isToday ? 'rgba(245,158,11,0.12)' : hasPastLesson ? 'rgba(201,169,120,0.15)' : 'transparent',
                border: hasFutureLesson && !sel ? '1px solid rgba(56,189,248,0.4)' : isToday && !sel ? '1px solid rgba(245,158,11,0.4)' : hasPastLesson && !sel ? '1px solid rgba(201,169,120,0.4)' : 'none',
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
            style={{ background: '#FBFBFB', maxHeight: '70vh', border: '1px solid rgba(27,59,47,0.12)' }}
          >
            {/* Modal header */}
            <div className="flex justify-between items-center px-5 py-4" style={{ borderBottom: '1px solid rgba(27,59,47,0.10)' }}>
              <div>
                <h3 className="text-base font-bold text-[#1B3B2F]">
                  {selectedDate && formatDisplayDate(selectedDate)}
                </h3>
                {slots.length > 0 && (
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(27,59,47,0.55)' }}>{slots[0].trainer_name}</p>
                )}
              </div>
              <button
                onClick={() => { setModalOpen(false); setConfirmSlot(null) }}
                className="w-8 h-8 flex items-center justify-center rounded-full text-lg font-bold"
                style={{ background: 'rgba(27,59,47,0.06)', color: 'rgba(27,59,47,0.55)' }}
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

              {loading && <p className="text-center py-8 text-sm" style={{ color: 'rgba(27,59,47,0.55)' }}>Yükleniyor...</p>}

              {!loading && slots.length === 0 && (
                <p className="text-center py-8 text-sm" style={{ color: 'rgba(27,59,47,0.55)' }}>Bu tarihte müsait ders bulunamadı.</p>
              )}

              {!loading && slots.length > 0 && (
                <div className="grid grid-cols-3 gap-1.5">
                  {slots.map((slot, idx) => {
                    const slotIsPastItem = isAdmin && isSlotPast(selectedDate, slot.slot_time) && (slot.slot_status === 'available' || slot.slot_status === 'past')
                    const st = slotIsPastItem
                      ? { bg: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)', color: '#a78bfa', label: '+ Ders Ekle' }
                      : slotStyle(slot.slot_status)
                    const isClosedSlot    = slot.slot_status === 'closed'
                    const isAvailableSlot = slot.slot_status === 'available'
                    return (
                      <div key={idx} className="relative">
                        <button
                          onClick={() => isAdmin && isClosedSlot ? setToggleSlot(slot) : handleSlotClick(slot)}
                          disabled={(!['available','own_reservation'].includes(slot.slot_status) && !(isAdmin && ['past','available','closed'].includes(slot.slot_status))) || bookingState === 'loading'}
                          className="w-full rounded-xl py-2 px-2 text-left transition-opacity disabled:cursor-default active:opacity-70"
                          style={{ background: st.bg, border: isAdmin && isClosedSlot ? '1px solid rgba(248,113,113,0.3)' : st.border }}
                        >
                          <p className="text-sm font-bold text-[#1B3B2F]">
                            {slot.slot_time.substring(0,5)} – {slotEnd(slot.slot_time)}
                          </p>
                          <p className="text-xs font-bold mt-0.5" style={{ color: isAdmin && isClosedSlot ? '#f87171' : st.color }}>
                            {isAdmin && isClosedSlot ? '🔓 Aç' : st.label}
                          </p>
                        </button>
                        {isAdmin && isAvailableSlot && !slotIsPastItem && (
                          <button
                            onClick={e => { e.stopPropagation(); setToggleSlot(slot) }}
                            className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-md text-xs active:opacity-60"
                            style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171' }}
                            title="Slotu kapat"
                          >🔒</button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Slot aç/kapat modal (admin) */}
      {toggleSlot && (
        <div className="fixed inset-0 z-[60] flex items-end" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div className="w-full rounded-t-3xl p-6 pb-32" style={{ background: '#FBFBFB', border: '1px solid rgba(27,59,47,0.12)' }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'rgba(27,59,47,0.12)' }} />
            <p className="font-bold text-base mb-1 text-[#1B3B2F]">{toggleSlot.trainer_name}</p>
            <p className="text-sm mb-1" style={{ color: 'rgba(27,59,47,0.55)' }}>
              {selectedDate && formatDisplayDate(selectedDate)} · {toggleSlot.slot_time.substring(0,5)} – {slotEnd(toggleSlot.slot_time)}
            </p>
            <p className="text-sm font-bold mb-6" style={{ color: toggleSlot.slot_status === 'closed' ? '#34d399' : '#f87171' }}>
              {toggleSlot.slot_status === 'closed' ? 'Bu slotu açmak istiyor musunuz?' : 'Bu slotu kapatmak istiyor musunuz?'}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setToggleSlot(null)} className="flex-1 py-3 rounded-2xl font-bold text-sm"
                style={{ background: 'rgba(27,59,47,0.06)', color: 'rgba(27,59,47,0.55)' }}>Vazgeç</button>
              <button onClick={handleToggleSlot} disabled={toggleSaving}
                className="flex-1 py-3 rounded-2xl font-bold text-sm disabled:opacity-40"
                style={toggleSlot.slot_status === 'closed'
                  ? { background: 'rgba(52,211,153,0.2)', color: '#34d399', border: '1px solid rgba(52,211,153,0.4)' }
                  : { background: 'rgba(248,113,113,0.2)', color: '#f87171', border: '1px solid rgba(248,113,113,0.4)' }}>
                {toggleSaving ? '...' : toggleSlot.slot_status === 'closed' ? '🔓 Slotu Aç' : '🔒 Slotu Kapat'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Geçmiş ders ekleme seçimi */}
      {pastSlot && (
        <div className="fixed inset-0 z-[60] flex items-end" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div className="w-full rounded-t-3xl p-6 pb-32" style={{ background: '#FBFBFB', border: '1px solid rgba(27,59,47,0.12)' }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'rgba(27,59,47,0.12)' }} />
            <p className="font-bold text-base mb-1 text-[#1B3B2F]">{pastSlot.trainer_name}</p>
            <p className="text-sm mb-6" style={{ color: 'rgba(27,59,47,0.55)' }}>
              {selectedDate && formatDisplayDate(selectedDate)} · {pastSlot.slot_time.substring(0,5)} – {slotEnd(pastSlot.slot_time)}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setPastSlot(null)} className="flex-1 py-3 rounded-2xl font-bold text-sm"
                style={{ background: 'rgba(27,59,47,0.06)', color: 'rgba(27,59,47,0.55)' }}>Vazgeç</button>
              <button onClick={() => savePastLesson('no_show')} disabled={pastSaving}
                className="flex-1 py-3 rounded-2xl font-bold text-sm disabled:opacity-40"
                style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                ✗ Gelmedi
              </button>
              <button onClick={() => savePastLesson('completed')} disabled={pastSaving}
                className="flex-1 py-3 rounded-2xl font-bold text-sm disabled:opacity-40"
                style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>
                ✓ Tamamlandı
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rezervasyon onay bottom-sheet */}
      {confirmSlot && (
        <div className="fixed inset-0 z-[60] flex items-end" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div
            className="w-full rounded-t-3xl p-6"
            style={{ background: '#FBFBFB', border: '1px solid rgba(27,59,47,0.12)' }}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'rgba(27,59,47,0.12)' }} />
            <h3 className="text-lg font-bold text-[#1B3B2F] mb-4">Ders Al</h3>

            <div className="rounded-2xl p-4 mb-5 space-y-2" style={{ background: 'rgba(27,59,47,0.04)', border: '1px solid rgba(27,59,47,0.10)' }}>
              <div className="flex items-center gap-3">
                <span className="text-xl">📅</span>
                <span className="text-sm font-bold text-[#1B3B2F]">{formatDisplayDate(selectedDate)}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xl">⏰</span>
                <span className="text-sm font-bold text-[#1B3B2F]">
                  {confirmSlot.slot_time.substring(0,5)} – {slotEnd(confirmSlot.slot_time)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xl">👤</span>
                <span className="text-sm font-bold text-[#1B3B2F]">{confirmSlot.trainer_name}</span>
              </div>
            </div>

            <p className="text-sm mb-6 text-center" style={{ color: 'rgba(27,59,47,0.55)' }}>
              Bu dersi almak istiyor musunuz?
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmSlot(null)}
                className="flex-1 py-3 rounded-2xl font-bold text-sm"
                style={{ background: 'rgba(27,59,47,0.06)', color: 'rgba(27,59,47,0.55)' }}
              >
                Vazgeç
              </button>
              <button
                onClick={handleConfirmBooking}
                disabled={bookingState === 'loading'}
                className="flex-1 py-3 rounded-2xl font-bold text-sm disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff' }}
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
