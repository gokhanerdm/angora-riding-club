'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import LogoutButton from '@/components/logout-button'

type Stats = { today_lessons: number; completed_lessons: number; monthly_reserved: number; next_month_reserved: number; monthly_prim: number }
type Reservation = { id: string; start_time: string; end_time: string; status: string; member_name: string }
type Member = { id: string; user_id: string; name: string; surname: string; remaining_lessons: number }
type MemberStats = { total_lessons: number; used_lessons: number; remaining_lessons: number; reserved_lessons: number }

const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']
const DAYS_TR = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi']

const SHIFT_SLOTS: Record<string, string[]> = {
  morning: [
    "10:30:00","11:00:00","11:30:00","12:00:00","12:30:00",
    "13:00:00","13:30:00","14:00:00","14:30:00","15:00:00",
    "15:30:00","16:00:00","16:30:00","17:00:00","17:30:00",
    "18:00:00","18:30:00","19:00:00","19:30:00",
  ],
  evening: [
    "14:00:00","14:30:00","15:00:00","15:30:00","16:00:00",
    "16:30:00","17:00:00","17:30:00","18:00:00","18:30:00",
    "19:00:00","19:30:00","20:00:00","20:30:00","21:00:00","21:30:00",
  ],
  fullday: [
    "10:30:00","11:00:00","11:30:00","12:00:00","12:30:00",
    "13:00:00","13:30:00","14:00:00","14:30:00","15:00:00",
    "15:30:00","16:00:00","16:30:00","17:00:00","17:30:00",
    "18:00:00","18:30:00","19:00:00","19:30:00","20:00:00",
    "20:30:00","21:00:00","21:30:00",
  ],
}

const EXTRA_SLOTS = ["22:00:00","22:30:00","23:00:00",]

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

function formatDayLabel(dateKey: string) {
  const [y,m,d] = dateKey.split('-').map(Number)
  const date = new Date(y, m-1, d)
  return `${DAYS_TR[date.getDay()]}, ${d} ${MONTHS_TR[m-1]}`
}

function formatTime(t: string) { return t.substring(0,5) }

function isFinished(dateKey: string, endTime: string) {
  return new Date() >= new Date(`${dateKey}T${endTime}+03:00`)
}

function isPastSlot(dateKey: string, slotTime: string) {
  return new Date() > new Date(`${dateKey}T${slotTime}+03:00`)
}

function statusLabel(s: string) {
  const map: Record<string,string> = {
    pending:'Beklemede', approved:'Onaylı',
    completed:'Tamamlandı', no_show:'Gelmedi', cancelled:'İptal'
  }
  return map[s] ?? s
}

function statusColor(s: string) {
  if (s === 'completed') return '#34d399'
  if (s === 'no_show') return '#f87171'
  return '#c8d6f0'
}

function addHalfHour(t: string) {
  const [h, m] = t.split(':').map(Number)
  const total = h * 60 + m + 30
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export default function TrainerDashboardClient({
  trainerId, trainerName, stats, initialShift
}: {
  trainerId: string
  trainerName: string
  stats: Stats
  initialShift: string | null
}) {
  const today = new Date()
  const [currentDate, setCurrentDate] = useState(toDateKey(today))
  const [reservations, setReservations] = useState<Record<string, Reservation>>({})
  const [closedSlots, setClosedSlots] = useState<Set<string>>(new Set())
  const [openExtraSlots, setOpenExtraSlots] = useState<Set<string>>(new Set())
  const [localStatuses, setLocalStatuses] = useState<Record<string, string>>({})
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [slotAction, setSlotAction] = useState<'menu' | 'addLesson' | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [shift, setShift] = useState<string>(initialShift ?? 'fullday')
  const [showShiftPicker, setShowShiftPicker] = useState(false)
  const [shiftSaving, setShiftSaving] = useState(false)
  const [showStudents, setShowStudents] = useState(false)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [selectedMemberStats, setSelectedMemberStats] = useState<MemberStats | null>(null)
  const [memberStatsLoading, setMemberStatsLoading] = useState(false)

  const slots = SHIFT_SLOTS[shift] ?? SHIFT_SLOTS.fullday

  const loadSchedule = async (dateKey: string) => {
    setScheduleLoading(true)
    const supabase = createClient()

    const [{ data: resData }, { data: scheduleData }] = await Promise.all([
      supabase.from('reservations')
        .select('id, start_time, end_time, status, members(name, surname)')
        .eq('trainer_id', trainerId)
        .eq('scheduled_date', dateKey)
        .neq('status', 'cancelled'),
      supabase.from('trainer_schedules')
        .select('start_time, is_available')
        .eq('trainer_id', trainerId)
        .eq('scheduled_date', dateKey)
    ])

    const resMap: Record<string, Reservation> = {}
    for (const r of resData ?? []) {
      const m = Array.isArray(r.members) ? r.members[0] : r.members
      resMap[r.start_time] = {
        id: r.id, start_time: r.start_time, end_time: r.end_time,
        status: r.status, member_name: m ? `${m.name} ${m.surname}` : 'Bilinmiyor'
      }
    }

    const closed = new Set<string>()
    const extra = new Set<string>()
    for (const s of scheduleData ?? []) {
      if (!s.is_available) closed.add(s.start_time)
      if (s.is_available && EXTRA_SLOTS.includes(s.start_time)) extra.add(s.start_time)
    }

    setReservations(resMap)
    setClosedSlots(closed)
    setOpenExtraSlots(extra)
    setLocalStatuses({})
    setSelectedSlot(null)
    setSlotAction(null)
    setScheduleLoading(false)
  }

  const loadMembers = async () => {
    setMembersLoading(true)
    const supabase = createClient()
    const { data: allowedData } = await supabase
      .from('member_allowed_trainers').select('member_id').eq('trainer_id', trainerId)
    const memberIds = (allowedData ?? []).map((r: any) => r.member_id)
    if (memberIds.length === 0) { setMembers([]); setMembersLoading(false); return }

    const [{ data: membersData }, { data: memberships }] = await Promise.all([
      supabase.from('members').select('id, user_id, name, surname').in('id', memberIds).is('deleted_at', null),
      supabase.from('memberships').select('member_id, total_lessons, used_lessons, reserved_lessons').in('member_id', memberIds).eq('is_current', true)
    ])

    const remainingMap = new Map<string, number>()
    for (const m of memberships ?? []) {
      remainingMap.set(m.member_id, (remainingMap.get(m.member_id) ?? 0) + (m.total_lessons - m.used_lessons - m.reserved_lessons))
    }
    setMembers((membersData ?? []).map((m: any) => ({
      id: m.id, user_id: m.user_id, name: m.name, surname: m.surname,
      remaining_lessons: remainingMap.get(m.id) ?? 0
    })))
    setMembersLoading(false)
  }

  useEffect(() => {
    loadSchedule(currentDate)
    loadMembers()
  }, [currentDate])

  const changeDate = (dir: number) => {
    const [y,m,d] = currentDate.split('-').map(Number)
    const date = new Date(y, m-1, d)
    date.setDate(date.getDate() + dir)
    setCurrentDate(toDateKey(date))
  }

  const handleSlotClick = (slot: string) => {
    setSelectedSlot(slot)
    setSlotAction('menu')
  }

  const handleBookMember = async (member: Member) => {
    if (member.remaining_lessons <= 0) {
      alert(`${member.name} ${member.surname} adlı üyenin dersi kalmamış.`)
      return
    }
    setActionLoading(true)
    const supabase = createClient()
    const endTime = new Date(`2000-01-01T${selectedSlot!}`)
    endTime.setMinutes(endTime.getMinutes() + 30)
    const { error } = await supabase.rpc('trainer_create_reservation', {
      p_member_id: member.id, p_trainer_id: trainerId,
      p_scheduled_date: currentDate, p_start_time: selectedSlot!,
      p_end_time: endTime.toTimeString().substring(0, 8),
    })
    if (error) alert('Hata: ' + error.message)
    else { await loadSchedule(currentDate); await loadMembers() }
    setActionLoading(false)
  }

  const handleCancelReservation = async (reservationId: string) => {
    if (!confirm('Bu dersi iptal etmek istediğinize emin misiniz?')) return
    setActionLoading(true)
    const supabase = createClient()
    await supabase.from('reservations').update({ status: 'cancelled' }).eq('id', reservationId)
    await loadSchedule(currentDate)
    setActionLoading(false)
  }

  const handleToggleClosed = async (slot: string, currentlyClosed: boolean) => {
    setActionLoading(true)
    const supabase = createClient()
    if (currentlyClosed) {
      await supabase.from('trainer_schedules').delete()
        .eq('trainer_id', trainerId).eq('scheduled_date', currentDate).eq('start_time', slot)
    } else {
      const endTime = new Date(`2000-01-01T${slot}`)
      endTime.setMinutes(endTime.getMinutes() + 30)
      await supabase.from('trainer_schedules').insert({
        trainer_id: trainerId, scheduled_date: currentDate,
        start_time: slot, end_time: endTime.toTimeString().substring(0, 8), is_available: false
      })
    }
    await loadSchedule(currentDate)
    setActionLoading(false)
  }

  const handleToggleExtra = async (slot: string, currentlyOpen: boolean) => {
    setActionLoading(true)
    const supabase = createClient()
    if (currentlyOpen) {
      await supabase.from('trainer_schedules').delete()
        .eq('trainer_id', trainerId).eq('scheduled_date', currentDate).eq('start_time', slot)
    } else {
      const endTime = new Date(`2000-01-01T${slot}`)
      endTime.setMinutes(endTime.getMinutes() + 30)
      await supabase.from('trainer_schedules').insert({
        trainer_id: trainerId, scheduled_date: currentDate,
        start_time: slot, end_time: endTime.toTimeString().substring(0, 8), is_available: true
      })
    }
    await loadSchedule(currentDate)
    setActionLoading(false)
  }

  const markLesson = async (reservationId: string, slot: string, status: 'completed' | 'no_show') => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('attendance').insert({ reservation_id: reservationId, status, marked_by: user?.id })
    await supabase.from('reservations').update({ status }).eq('id', reservationId)
    setLocalStatuses(prev => ({ ...prev, [slot]: status }))
    setSelectedSlot(null)
    setSlotAction(null)
  }

  const handleMemberClick = async (member: Member) => {
    setSelectedMember(member)
    setSelectedMemberStats(null)
    setMemberStatsLoading(true)
    const supabase = createClient()
    const { data } = await supabase.rpc('member_dashboard_stats', { user_id: member.user_id })
    const stats = data?.[0]
    if (stats) {
      setSelectedMemberStats({
        total_lessons: stats.total_lessons ?? 0,
        used_lessons: stats.used_lessons ?? 0,
        remaining_lessons: stats.remaining_lessons ?? 0,
        reserved_lessons: stats.reserved_lessons ?? 0,
      })
    } else {
      setSelectedMemberStats({ total_lessons: 0, used_lessons: 0, remaining_lessons: 0, reserved_lessons: 0 })
    }
    setMemberStatsLoading(false)
  }

  const saveShift = async (newShift: string) => {
    setShiftSaving(true)
    const supabase = createClient()
    await supabase.from('trainers').update({ shift: newShift }).eq('id', trainerId)
    setShift(newShift)
    setShowShiftPicker(false)
    setShiftSaving(false)
  }

  const currentMonth = MONTHS_TR[today.getMonth()]
  const nextMonthName = MONTHS_TR[(today.getMonth() + 1) % 12]

  const visibleSlots = [
    ...slots,
    ...EXTRA_SLOTS.filter(s => openExtraSlots.has(s))
  ]

  const selectedRes = selectedSlot ? reservations[selectedSlot] : undefined
  const selectedClosed = selectedSlot ? closedSlots.has(selectedSlot) : false
  const selectedCurrentStatus = selectedSlot ? (localStatuses[selectedSlot] ?? selectedRes?.status) : undefined

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #0a0f2e 0%, #0d1b4b 40%, #071428 100%)' }}
    >
      {/* Header */}
      <div className="px-5 pt-12 pb-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(245,158,11,0.4)' }}
          >
            <span className="text-2xl">🏇</span>
          </div>
          <div>
            <p className="text-[10px] font-medium tracking-widest" style={{ color: '#7b93c4' }}>Hoş geldin</p>
            <h1 className="text-2xl font-bold text-white">{trainerName}</h1>
          </div>
        </div>
        <button
          onClick={() => setShowShiftPicker(true)}
          className="text-xs font-bold px-3 py-2 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.08)', color: '#c8d6f0', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          Slotlar
        </button>
      </div>

      {/* Stat cards 3x2 */}
      <div className="grid grid-cols-3 gap-1.5 px-5 mb-2 flex-shrink-0">
        {[
          { label: 'Günün dersleri', value: stats.today_lessons, color: '#c8d6f0', clickable: false },
          { label: `${currentMonth} yapılacak`, value: stats.monthly_reserved, color: '#c8d6f0', clickable: false },
          { label: `${nextMonthName} yapılacak`, value: stats.next_month_reserved, color: '#38bdf8', clickable: false },
          { label: `${currentMonth} yapılan`, value: stats.completed_lessons, color: '#34d399', clickable: false },
          { label: `${currentMonth} prim`, value: `${(stats.monthly_prim ?? 0).toLocaleString('tr-TR')}₺`, color: '#f59e0b', clickable: false },
          { label: 'Öğrencilerim', value: members.length, color: '#c8d6f0', clickable: true },
        ].map((card) => (
          <button
            key={card.label}
            onClick={card.clickable ? () => setShowStudents(p => !p) : undefined}
            disabled={!card.clickable}
            className="rounded-xl flex flex-col items-center justify-center"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
              padding: '6px 6px',
              height: 52,
              cursor: card.clickable ? 'pointer' : 'default',
            }}
          >
            <p className="text-[8px] font-medium uppercase tracking-wide leading-tight mb-1 text-center" style={{ color: '#7b93c4' }}>{card.label}</p>
            <p className="text-base font-bold text-center" style={{ color: card.color }}>{card.value}</p>
          </button>
        ))}
      </div>

      {/* Tarih nav */}
      <div className="flex items-center justify-between px-5 mb-2 flex-shrink-0">
        <button onClick={() => changeDate(-1)}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold"
          style={{ background: 'rgba(255,255,255,0.06)', color: '#7b93c4', border: '1px solid rgba(255,255,255,0.08)' }}>
          ←
        </button>
        <p className="text-sm font-bold text-white">{formatDayLabel(currentDate)}</p>
        <button onClick={() => changeDate(1)}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold"
          style={{ background: 'rgba(255,255,255,0.06)', color: '#7b93c4', border: '1px solid rgba(255,255,255,0.08)' }}>
          →
        </button>
      </div>

      {/* Slot grid - no scroll, fills remaining space */}
      <div className="flex-1 px-5 pb-4 overflow-hidden">
        {scheduleLoading
          ? <p className="text-center py-8 text-sm" style={{ color: '#7b93c4' }}>Yükleniyor...</p>
          : (
            <div className="grid grid-cols-2 gap-1 h-full content-start">
              {visibleSlots.map(slot => {
                const res = reservations[slot]
                const isClosed = closedSlots.has(slot)
                const isExtra = openExtraSlots.has(slot)
                const past = isPastSlot(currentDate, slot)
                const currentStatus = localStatuses[slot] ?? res?.status
                const isSelected = selectedSlot === slot

                let bg = 'rgba(255,255,255,0.04)'
                let borderColor = 'rgba(255,255,255,0.07)'
                let timeColor = past && !res && !isClosed ? 'rgba(74,97,144,0.4)' : '#c8d6f0'
                let subText = ''
                let subColor = '#34d399'

                if (res) {
                  bg = currentStatus === 'completed' ? 'rgba(52,211,153,0.08)' :
                       currentStatus === 'no_show' ? 'rgba(248,113,113,0.08)' : 'rgba(255,255,255,0.07)'
                  borderColor = currentStatus === 'completed' ? 'rgba(52,211,153,0.25)' :
                                currentStatus === 'no_show' ? 'rgba(248,113,113,0.25)' : 'rgba(255,255,255,0.15)'
                  subText = res.member_name.split(' ')[0]
                  subColor = statusColor(currentStatus ?? res.status)
                } else if (isClosed) {
                  bg = 'rgba(255,255,255,0.02)'
                  timeColor = 'rgba(74,97,144,0.4)'
                  subText = 'Kapalı'
                  subColor = 'rgba(74,97,144,0.5)'
                } else if (isExtra) {
                  subText = 'Özel açık'
                  subColor = '#f59e0b'
                } else if (!past) {
                  subText = 'Müsait'
                  subColor = '#34d399'
                }

                return (
                  <button
                    key={slot}
                    onClick={() => (!past || res || isClosed || isExtra) ? handleSlotClick(slot) : undefined}
                    disabled={past && !res && !isClosed && !isExtra}
                    className="flex items-center justify-between px-3 rounded-lg transition-all text-left"
                    style={{
                      background: isSelected ? 'rgba(255,255,255,0.14)' : bg,
                      border: `1px solid ${isSelected ? 'rgba(255,255,255,0.35)' : borderColor}`,
                      cursor: past && !res && !isClosed && !isExtra ? 'default' : 'pointer',
                      height: 32,
                    }}
                  >
                    <span className="text-[11px] font-bold" style={{ color: timeColor }}>
                      {formatTime(slot)} – {formatTime(addHalfHour(slot))}
                    </span>
                    {subText && (
                      <span className="text-[10px] font-medium truncate ml-1" style={{ color: subColor, maxWidth: '45%' }}>{subText}</span>
                    )}
                  </button>
                )
              })}

              {EXTRA_SLOTS.filter(s => !openExtraSlots.has(s)).map(slot => (
                <button
                  key={`extra-${slot}`}
                  onClick={() => handleToggleExtra(slot, false)}
                  disabled={actionLoading}
                  className="flex items-center justify-between px-3 rounded-lg text-left"
                  style={{ background: 'rgba(245,158,11,0.05)', border: '1px dashed rgba(245,158,11,0.2)', height: 32 }}
                >
                  <span className="text-[11px] font-bold" style={{ color: 'rgba(245,158,11,0.5)' }}>{formatTime(slot)} – {formatTime(addHalfHour(slot))}</span>
                  <span className="text-[10px]" style={{ color: 'rgba(245,158,11,0.4)' }}>+ Aç</span>
                </button>
              ))}
            </div>
          )
        }
      </div>

      {/* Slot action bottom sheet */}
      {selectedSlot && slotAction && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.65)' }}
          onClick={() => { setSelectedSlot(null); setSlotAction(null) }}>
          <div
            className="w-full rounded-t-3xl px-5 pt-5 pb-10"
            style={{ background: '#0d1b4b', border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <p className="font-bold text-white text-base">{formatTime(selectedSlot)}</p>
              <button onClick={() => { setSelectedSlot(null); setSlotAction(null) }}
                className="w-8 h-8 flex items-center justify-center rounded-full text-lg font-bold"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#7b93c4' }}>✕</button>
            </div>

            {slotAction === 'menu' && (
              <>
                {selectedRes && (() => {
                  const done = selectedCurrentStatus === 'completed' || selectedCurrentStatus === 'no_show'
                  const finished = isFinished(currentDate, selectedRes.end_time)
                  const future = !isPastSlot(currentDate, selectedSlot)
                  return (
                    <div className="space-y-2">
                      <p className="font-bold text-white">{selectedRes.member_name}</p>
                      <p className="text-sm font-bold" style={{ color: statusColor(selectedCurrentStatus ?? selectedRes.status) }}>
                        {statusLabel(selectedCurrentStatus ?? selectedRes.status)}
                      </p>
                      {!done && finished && (
                        <>
                          <button onClick={() => markLesson(selectedRes.id, selectedSlot, 'completed')}
                            disabled={actionLoading}
                            className="w-full py-3 rounded-2xl text-sm font-bold"
                            style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399' }}>
                            Tamamlandı
                          </button>
                          <button onClick={() => markLesson(selectedRes.id, selectedSlot, 'no_show')}
                            disabled={actionLoading}
                            className="w-full py-3 rounded-2xl text-sm font-bold"
                            style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>
                            Gelmedi
                          </button>
                        </>
                      )}
                      {future && !done && (
                        <button onClick={() => handleCancelReservation(selectedRes.id)}
                          disabled={actionLoading}
                          className="w-full py-3 rounded-2xl text-sm font-bold"
                          style={{ background: 'rgba(255,255,255,0.06)', color: '#c8d6f0' }}>
                          İptal Et
                        </button>
                      )}
                    </div>
                  )
                })()}

                {selectedClosed && !selectedRes && (
                  <button onClick={() => handleToggleClosed(selectedSlot, true)}
                    disabled={actionLoading}
                    className="w-full py-3 rounded-2xl text-sm font-bold"
                    style={{ background: 'rgba(255,255,255,0.08)', color: '#c8d6f0' }}>
                    Slotu Aç
                  </button>
                )}

                {selectedSlot && openExtraSlots.has(selectedSlot) && !selectedRes && (
                  <button onClick={() => handleToggleExtra(selectedSlot, true)}
                    disabled={actionLoading}
                    className="w-full py-3 rounded-2xl text-sm font-bold"
                    style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171' }}>
                    Özel Slotu Kapat
                  </button>
                )}

                {!selectedRes && !selectedClosed && !openExtraSlots.has(selectedSlot) && !isPastSlot(currentDate, selectedSlot) && (
                  <div className="space-y-2">
                    <button onClick={() => handleToggleClosed(selectedSlot, false)}
                      disabled={actionLoading}
                      className="w-full py-3 rounded-2xl text-sm font-bold"
                      style={{ background: 'rgba(255,255,255,0.06)', color: '#c8d6f0', border: '1px solid rgba(255,255,255,0.1)' }}>
                      Slotu Kapat
                    </button>
                    <button onClick={() => setSlotAction('addLesson')}
                      className="w-full py-3 rounded-2xl text-sm font-bold"
                      style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.25)' }}>
                      Ders Ekle
                    </button>
                  </div>
                )}
              </>
            )}

            {slotAction === 'addLesson' && (
              <div>
                <button onClick={() => setSlotAction('menu')} className="text-sm mb-4" style={{ color: '#7b93c4' }}>
                  ← Geri
                </button>
                <p className="text-sm font-bold text-white mb-3">Öğrenci seç:</p>
                {membersLoading
                  ? <p className="text-sm" style={{ color: '#7b93c4' }}>Yükleniyor...</p>
                  : members.length === 0
                    ? <p className="text-sm" style={{ color: '#7b93c4' }}>Atanmış öğrenci yok.</p>
                    : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {members.map(member => (
                          <button key={member.id}
                            onClick={() => handleBookMember(member)}
                            disabled={actionLoading}
                            className="w-full rounded-2xl p-3 text-left flex justify-between items-center"
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <p className="text-sm font-bold text-white">{member.name} {member.surname}</p>
                            <p className="text-xs font-bold" style={{ color: member.remaining_lessons <= 0 ? '#f87171' : '#34d399' }}>
                              {member.remaining_lessons <= 0 ? 'Ders yok' : `${member.remaining_lessons} ders`}
                            </p>
                          </button>
                        ))}
                      </div>
                    )
                }
              </div>
            )}
          </div>
        </div>
      )}

      {/* Öğrenci modal */}
      {showStudents && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.65)' }}
          onClick={() => { setShowStudents(false); setSelectedMember(null) }}>
          <div
            className="w-full rounded-t-3xl px-5 pt-5 pb-10"
            style={{ background: '#0d1b4b', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '75vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              {selectedMember ? (
                <button onClick={() => setSelectedMember(null)} className="text-sm flex items-center gap-1" style={{ color: '#7b93c4' }}>
                  ← Geri
                </button>
              ) : (
                <p className="font-bold text-white text-base">Öğrencilerim</p>
              )}
              <button onClick={() => { setShowStudents(false); setSelectedMember(null) }}
                className="w-8 h-8 flex items-center justify-center rounded-full text-lg font-bold"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#7b93c4' }}>✕</button>
            </div>

            {/* Öğrenci listesi */}
            {!selectedMember && (
              membersLoading
                ? <p className="text-sm text-center py-8" style={{ color: '#7b93c4' }}>Yükleniyor...</p>
                : members.length === 0
                  ? <p className="text-sm text-center py-8" style={{ color: '#7b93c4' }}>Atanmış öğrenci yok.</p>
                  : (
                    <div className="space-y-2">
                      {members.map(m => (
                        <button
                          key={m.id}
                          onClick={() => handleMemberClick(m)}
                          className="w-full rounded-2xl px-4 py-3 flex justify-between items-center text-left"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                        >
                          <p className="text-sm font-bold text-white">{m.name} {m.surname}</p>
                          <p className="text-xs font-bold" style={{ color: m.remaining_lessons <= 0 ? '#f87171' : '#34d399' }}>
                            {m.remaining_lessons <= 0 ? 'Ders yok' : `${m.remaining_lessons} ders`}
                          </p>
                        </button>
                      ))}
                    </div>
                  )
            )}

            {/* Öğrenci detay */}
            {selectedMember && (
              <div>
                <p className="text-lg font-bold text-white mb-4">{selectedMember.name} {selectedMember.surname}</p>
                {memberStatsLoading
                  ? <p className="text-sm text-center py-8" style={{ color: '#7b93c4' }}>Yükleniyor...</p>
                  : selectedMemberStats && (
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: 'Toplam ders', value: selectedMemberStats.total_lessons, color: '#c8d6f0' },
                        { label: 'Kullanılan', value: selectedMemberStats.used_lessons, color: '#c8d6f0' },
                        { label: 'Kalan ders', value: selectedMemberStats.remaining_lessons, color: '#34d399' },
                        { label: 'Bekleyen', value: selectedMemberStats.reserved_lessons, color: '#38bdf8' },
                      ].map(card => (
                        <div key={card.label} className="rounded-2xl p-3 text-center"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <p className="text-[9px] font-medium uppercase tracking-wide mb-1" style={{ color: '#7b93c4' }}>{card.label}</p>
                          <p className="text-xl font-bold" style={{ color: card.color }}>{card.value}</p>
                        </div>
                      ))}
                    </div>
                  )
                }
              </div>
            )}
          </div>
        </div>
      )}

      {/* Slot seçici (vardiya) */}
      {showShiftPicker && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.65)' }}
          onClick={() => setShowShiftPicker(false)}>
          <div
            className="w-full rounded-t-3xl px-5 pt-5 pb-10"
            style={{ background: '#0d1b4b', border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-5">
              <p className="font-bold text-white text-base">Slot Seçimi</p>
              <button onClick={() => setShowShiftPicker(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-lg font-bold"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#7b93c4' }}>✕</button>
            </div>
            <p className="text-xs mb-4" style={{ color: '#7b93c4' }}>Seçtiğin slot aralığı tüm günlerde varsayılan olarak uygulanır. İstediğin günü günlük olarak değiştirebilirsin.</p>
            <div className="space-y-2">
              {[
                { key: 'morning', label: '☀️ Sabah', desc: '10:30 — 19:30' },
                { key: 'evening', label: '🌙 Akşam', desc: '14:00 — 21:30' },
                { key: 'fullday', label: '🌅 Tam Gün', desc: '10:30 — 21:30' },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => saveShift(opt.key)}
                  disabled={shiftSaving}
                  className="w-full rounded-2xl p-4 text-left flex justify-between items-center"
                  style={{
                    background: shift === opt.key ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${shift === opt.key ? 'rgba(56,189,248,0.35)' : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  <div>
                    <p className="text-sm font-bold text-white">{opt.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#7b93c4' }}>{opt.desc}</p>
                  </div>
                  {shift === opt.key && <span style={{ color: '#38bdf8' }}>✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Çıkış */}
      <div className="px-5 pb-8 pt-2 flex justify-center flex-shrink-0">
        <LogoutButton className="text-xs font-bold text-amber-400 px-4 py-2 rounded-xl transition-opacity hover:text-amber-300" />
      </div>
    </div>
  )
}
