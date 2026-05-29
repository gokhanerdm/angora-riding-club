'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']
const DAYS_TR = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi']

const SLOTS = [
  "15:00:00","15:30:00","16:00:00","16:30:00",
  "17:00:00","17:30:00","18:00:00","18:30:00",
  "19:00:00","19:30:00","20:00:00","20:30:00",
  "21:00:00","21:30:00","22:00:00",
]

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

function formatDayLabel(dateKey: string) {
  const [y,m,d] = dateKey.split('-').map(Number)
  const date = new Date(y, m-1, d)
  return `${DAYS_TR[date.getDay()]}, ${d} ${MONTHS_TR[m-1]} ${y}`
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
  if (s === 'completed') return 'text-green-400'
  if (s === 'no_show') return 'text-red-400'
  return 'text-gray-300'
}

type Stats = { today_lessons: number; completed_lessons: number; monthly_reserved: number; monthly_prim: number }
type Reservation = { id: string; start_time: string; end_time: string; status: string; member_name: string }
type Member = { id: string; name: string; surname: string; remaining_lessons: number }
type SelectedSlot = { slot: string; reservation?: Reservation; isClosed: boolean } | null

export default function TrainerDashboardClient({
  trainerId, trainerName, stats
}: {
  trainerId: string; trainerName: string; stats: Stats
}) {
  const [currentDate, setCurrentDate] = useState(toDateKey(new Date()))
  const [reservations, setReservations] = useState<Record<string, Reservation>>({})
  const [closedSlots, setClosedSlots] = useState<Set<string>>(new Set())
  const [localStatuses, setLocalStatuses] = useState<Record<string, string>>({})
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [scheduleLoading, setScheduleLoading] = useState(false)

  const loadSchedule = async (dateKey: string) => {
    setScheduleLoading(true)
    const supabase = createClient()

    const [{ data: resData }, { data: closedData }] = await Promise.all([
      supabase
        .from('reservations')
        .select('id, start_time, end_time, status, members(name, surname)')
        .eq('trainer_id', trainerId)
        .eq('scheduled_date', dateKey)
        .neq('status', 'cancelled'),
      supabase
        .from('trainer_schedules')
        .select('start_time')
        .eq('trainer_id', trainerId)
        .eq('scheduled_date', dateKey)
        .eq('is_available', false)
    ])

    const resMap: Record<string, Reservation> = {}
    for (const r of resData ?? []) {
      const m = Array.isArray(r.members) ? r.members[0] : r.members
      resMap[r.start_time] = {
        id: r.id, start_time: r.start_time, end_time: r.end_time,
        status: r.status, member_name: m ? `${m.name} ${m.surname}` : 'Bilinmiyor'
      }
    }

    setReservations(resMap)
    setClosedSlots(new Set((closedData ?? []).map((c: any) => c.start_time)))
    setLocalStatuses({})
    setSelectedSlot(null)
    setScheduleLoading(false)
  }

  const loadMembers = async () => {
    setMembersLoading(true)
    const supabase = createClient()

    const { data: allowedData } = await supabase
      .from('member_allowed_trainers')
      .select('member_id')
      .eq('trainer_id', trainerId)

    const memberIds = (allowedData ?? []).map((r: any) => r.member_id)

    if (memberIds.length === 0) {
      setMembers([])
      setMembersLoading(false)
      return
    }

    const [{ data: membersData }, { data: memberships }] = await Promise.all([
      supabase.from('members').select('id, name, surname').in('id', memberIds).is('deleted_at', null),
      supabase.from('memberships').select('member_id, total_lessons, used_lessons, reserved_lessons').in('member_id', memberIds).eq('is_current', true)
    ])

    const remainingMap = new Map<string, number>()
    for (const m of memberships ?? []) {
      const current = remainingMap.get(m.member_id) ?? 0
      remainingMap.set(m.member_id, current + (m.total_lessons - m.used_lessons - m.reserved_lessons))
    }

    setMembers((membersData ?? []).map((m: any) => ({
      id: m.id, name: m.name, surname: m.surname,
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
    const res = reservations[slot]
    const isClosed = closedSlots.has(slot)
    setSelectedSlot({ slot, reservation: res, isClosed })
  }

  const handleBookMember = async (member: Member) => {
    if (member.remaining_lessons <= 0) {
      alert(`${member.name} ${member.surname} adlı üyenin dersi kalmamış.`)
      return
    }
    setActionLoading(true)
    const supabase = createClient()
    const slot = selectedSlot!.slot
    const endTime = new Date(`2000-01-01T${slot}`)
    endTime.setMinutes(endTime.getMinutes() + 30)

    const { error } = await supabase.rpc('trainer_create_reservation', {
      p_member_id: member.id,
      p_trainer_id: trainerId,
      p_scheduled_date: currentDate,
      p_start_time: slot,
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

  const markLesson = async (reservationId: string, slot: string, status: 'completed' | 'no_show') => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('attendance').insert({ reservation_id: reservationId, status, marked_by: user?.id })
    await supabase.from('reservations').update({ status }).eq('id', reservationId)
    setLocalStatuses(prev => ({ ...prev, [slot]: status }))
    setSelectedSlot(null)
  }

  const currentMonth = MONTHS_TR[new Date().getMonth()]

  return (
    <div className="h-screen flex flex-col text-white overflow-hidden">
      {/* Üst başlık */}
      <div className="px-6 pt-4 pb-2 flex-shrink-0">
        <h1 className="text-2xl font-bold">Hoş geldin, {trainerName}</h1>
      </div>

      {/* 4 kart */}
      <div className="px-6 pb-3 grid grid-cols-4 gap-3 flex-shrink-0">
        <div className="rounded-xl bg-gray-800 p-4">
  <p className="text-xs text-gray-400">Günün</p>
  <p className="text-xs text-gray-400 mb-1">Dersleri</p>
  <p className="text-3xl font-bold">{stats.today_lessons}</p>
</div>
<div className="rounded-xl bg-gray-800 p-4">
  <p className="text-xs text-gray-400">{currentMonth}</p>
  <p className="text-xs text-gray-400 mb-1">Kalan Dersler</p>
  <p className="text-3xl font-bold">{stats.monthly_reserved}</p>
</div>
<div className="rounded-xl bg-gray-800 p-4">
  <p className="text-xs text-gray-400">{currentMonth}</p>
  <p className="text-xs text-gray-400 mb-1">Yapılan Dersler</p>
  <p className="text-3xl font-bold">{stats.completed_lessons}</p>
</div>
<div className="rounded-xl bg-gray-800 p-4">
  <p className="text-xs text-gray-400">{currentMonth}</p>
  <p className="text-xs text-gray-400 mb-1">Prim</p>
  <p className="text-2xl font-bold text-amber-400">{(stats.monthly_prim ?? 0).toLocaleString('tr-TR')} ₺</p>
</div>
        </div>

      {/* Ders programı */}
      <div className="px-6 flex gap-4 flex-1 min-h-0">
        {/* Sol: program */}
        <div className="flex flex-col flex-1 min-h-0">
          {/* Tarih nav */}
          <div className="flex items-center justify-between mb-2 flex-shrink-0">
            <button onClick={() => changeDate(-1)}
              className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-sm">←</button>
            <p className="text-sm font-bold">{formatDayLabel(currentDate)}</p>
            <button onClick={() => changeDate(1)}
              className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-sm">→</button>
          </div>

          {/* Slotlar — flex ile eşit dağılım */}
          <div className="flex flex-col flex-1 gap-1 min-h-0">
            {scheduleLoading
              ? <p className="text-center text-gray-400 py-8">Yükleniyor...</p>
              : SLOTS.map(slot => {
                const res = reservations[slot]
                const isClosed = closedSlots.has(slot)
                const past = isPastSlot(currentDate, slot)
                const currentStatus = localStatuses[slot] ?? res?.status
                const isSelected = selectedSlot?.slot === slot

                let bg = 'bg-gray-700/60'
                let textColor = 'text-white'
                let subText = <span className="text-xs text-green-400">Müsait</span>

                if (res) {
                  bg = currentStatus === 'completed' ? 'bg-green-900/30' :
                       currentStatus === 'no_show' ? 'bg-red-900/30' : 'bg-gray-700'
                  subText = <span className={`text-xs font-bold ${statusColor(currentStatus ?? res.status)}`}>
                    {res.member_name} · {statusLabel(currentStatus ?? res.status)}
                  </span>
                } else if (isClosed) {
                  bg = 'bg-gray-700/30'
                  textColor = 'text-gray-500'
                  subText = <span className="text-xs text-gray-600">Kapalı</span>
                } else if (past) {
                  bg = 'bg-gray-700/20'
                  textColor = 'text-gray-600'
                  subText = <></>
                }

                return (
                  <button
                    key={slot}
                    onClick={() => handleSlotClick(slot)}
                    disabled={past && !res && !isClosed}
                    className={`flex-1 rounded-lg px-3 flex items-center justify-between transition-colors border ${
                      isSelected ? 'border-blue-500' : 'border-transparent'
                    } ${bg} ${past && !res && !isClosed ? 'cursor-default' : 'hover:brightness-110'}`}
                  >
                    <span className={`text-sm font-bold ${textColor}`}>
  {formatTime(slot)} - {formatTime(SLOTS[SLOTS.indexOf(slot) + 1] ?? '22:30:00')}
</span>
                    {subText}
                  </button>
                )
              })
            }
          </div>
        </div>

        {/* Sağ: aksiyon paneli */}
        {selectedSlot && (
          <div className="w-52 bg-gray-700 rounded-xl p-4 flex-shrink-0 flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <p className="font-bold text-white">{formatTime(selectedSlot.slot)}</p>
              <button onClick={() => setSelectedSlot(null)} className="text-gray-400 hover:text-white text-lg">✕</button>
            </div>

            {/* Dolu slot */}
            {selectedSlot.reservation && (() => {
              const res = selectedSlot.reservation!
              const currentStatus = localStatuses[selectedSlot.slot] ?? res.status
              const done = currentStatus === 'completed' || currentStatus === 'no_show'
              const finished = isFinished(currentDate, res.end_time)
              const future = !isPastSlot(currentDate, selectedSlot.slot)

              return (
                <div className="space-y-2 flex-1">
                  <p className="text-sm font-bold text-white">{res.member_name}</p>
                  <p className={`text-xs font-bold ${statusColor(currentStatus)}`}>{statusLabel(currentStatus)}</p>
                  {!done && finished && (
                    <>
                      <button onClick={() => markLesson(res.id, selectedSlot.slot, 'completed')}
                        disabled={actionLoading}
                        className="w-full bg-green-600 text-white font-bold py-2 rounded-lg hover:bg-green-700 text-xs">
                        Tamamlandı
                      </button>
                      <button onClick={() => markLesson(res.id, selectedSlot.slot, 'no_show')}
                        disabled={actionLoading}
                        className="w-full bg-red-600 text-white font-bold py-2 rounded-lg hover:bg-red-700 text-xs">
                        Gelmedi
                      </button>
                    </>
                  )}
                  {future && !done && (
                    <button onClick={() => handleCancelReservation(res.id)}
                      disabled={actionLoading}
                      className="w-full bg-gray-600 text-white font-bold py-2 rounded-lg hover:bg-gray-500 text-xs">
                      İptal Et
                    </button>
                  )}
                </div>
              )
            })()}

            {/* Kapalı slot */}
            {selectedSlot.isClosed && !selectedSlot.reservation && (
              <button onClick={() => handleToggleClosed(selectedSlot.slot, true)}
                disabled={actionLoading}
                className="w-full bg-gray-600 text-white font-bold py-2 rounded-lg hover:bg-gray-500 text-xs">
                Slotu Aç
              </button>
            )}

            {/* Boş müsait slot */}
            {!selectedSlot.reservation && !selectedSlot.isClosed && !isPastSlot(currentDate, selectedSlot.slot) && (
              <div className="space-y-2 flex-1 flex flex-col min-h-0">
                <button onClick={() => handleToggleClosed(selectedSlot.slot, false)}
                  disabled={actionLoading}
                  className="w-full bg-gray-600 text-white font-bold py-2 rounded-lg hover:bg-gray-500 text-xs flex-shrink-0">
                  Slotu Kapat
                </button>
                <p className="text-xs text-gray-400 flex-shrink-0">Ders Koy:</p>
                {membersLoading
                  ? <p className="text-xs text-gray-400">Yükleniyor...</p>
                  : members.length === 0
                    ? <p className="text-xs text-gray-400">Atanmış üye yok.</p>
                    : (
                      <div className="space-y-1 overflow-y-auto flex-1">
                        {members.map(member => (
                          <button key={member.id}
                            onClick={() => handleBookMember(member)}
                            disabled={actionLoading}
                            className="w-full rounded-lg p-2 text-left bg-gray-600 hover:bg-gray-500 transition-colors">
                            <p className="text-xs font-bold text-white">{member.name} {member.surname}</p>
                            {member.remaining_lessons <= 0
                              ? <p className="text-xs text-red-400">Ders yok — Talep Et</p>
                              : <p className="text-xs text-green-400">{member.remaining_lessons} ders</p>
                            }
                          </button>
                        ))}
                      </div>
                    )
                }
              </div>
            )}
          </div>
        )}
      </div>

      {/* Alt boşluk */}
      <div className="h-4 flex-shrink-0" />
    </div>
  )
}