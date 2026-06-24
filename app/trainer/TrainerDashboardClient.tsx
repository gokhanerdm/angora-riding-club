'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import LogoutButton from '@/components/logout-button'
import { isSlotPast } from '@/lib/lessons/time'

type Stats = { today_lessons: number; completed_lessons: number; monthly_reserved: number; next_month_reserved: number; monthly_prim: number }
type Reservation = { id: string; start_time: string; end_time: string; status: string; member_name: string; member_id: string; type: string }
type Member = { id: string; user_id: string; name: string; surname: string; remaining_lessons: number }
type MemberStats = { total_lessons: number; used_lessons: number; remaining_lessons: number; reserved_lessons: number }

const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']
const DAYS_TR = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi']

const SHIFT_SLOTS: Record<string, string[]> = {
  weekend: [
    "10:30:00","11:00:00","11:30:00","12:00:00","12:30:00",
    "13:00:00","13:30:00","14:00:00","14:30:00","15:00:00",
    "15:30:00","16:00:00","16:30:00","17:00:00","17:30:00",
    "18:00:00","18:30:00","19:00:00","19:30:00","20:00:00",
  ],
  morning: [
    "10:30:00","11:00:00","11:30:00","12:00:00","12:30:00",
    "13:00:00","13:30:00","14:00:00","14:30:00","15:00:00",
    "15:30:00","16:00:00","16:30:00","17:00:00","17:30:00",
    "18:00:00","18:30:00","19:00:00","19:30:00","20:00:00",
  ],
  evening: [
    "15:00:00","15:30:00","16:00:00","16:30:00","17:00:00",
    "17:30:00","18:00:00","18:30:00","19:00:00","19:30:00",
    "20:00:00","20:30:00","21:00:00","21:30:00","22:00:00",
  ],
  fullday: [
    "11:00:00","11:30:00","12:00:00","12:30:00","13:00:00",
    "13:30:00","14:00:00","14:30:00","15:00:00","15:30:00",
    "16:00:00","16:30:00","17:00:00","17:30:00","18:00:00",
    "18:30:00","19:00:00","19:30:00","20:00:00","20:30:00",
    "21:00:00","21:30:00","22:00:00",
  ],
}

const EXTRA_SLOTS = ["22:30:00","23:00:00",]

// Slot arşivi: bu tarihten önceki günler için sabit 10:00-23:00 tam liste kullanılır,
// bu tarihten sonraki günler için ilk görüntülemede o anki slot listesi donar.
const SLOT_ARCHIVE_CUTOFF = '2026-06-01'

const FULL_SLOTS: string[] = (() => {
  const out: string[] = []
  for (let h = 10; h <= 23; h++) {
    out.push(`${String(h).padStart(2,'0')}:00:00`)
    if (h < 23) out.push(`${String(h).padStart(2,'0')}:30:00`)
  }
  return out
})()

function todayKeyIstanbul() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' })
}

const SHIFT_LABELS: Record<string, string> = {
  morning: 'Sabah', evening: 'Akşam', fullday: 'Tam Gün', weekend: 'Hafta Sonu',
}

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
  return isSlotPast(dateKey, endTime)
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
  return '#1B3B2F'
}

function addHalfHour(t: string) {
  const [h, m] = t.split(':').map(Number)
  const total = h * 60 + m + 30
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export default function TrainerDashboardClient({
  trainerId, trainerName, stats, initialShift, isAdminView
}: {
  trainerId: string
  trainerName: string
  stats: Stats
  initialShift: string | null
  isAdminView?: boolean
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
  const [dailyShift, setDailyShift] = useState<string | null>(null)
  const [dailyShiftSaving, setDailyShiftSaving] = useState(false)
  const [toast, setToast] = useState('')
  const showFeedback = (msg: string, ok: boolean) => { setToast(msg); setTimeout(() => setToast(''), 3000) }
  const [showStudents, setShowStudents] = useState(false)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [selectedMemberStats, setSelectedMemberStats] = useState<MemberStats | null>(null)
  const [memberStatsLoading, setMemberStatsLoading] = useState(false)

  const [effectiveSlots, setEffectiveSlots] = useState<string[]>(SHIFT_SLOTS.fullday)

  // Sayfa açılışında saati geçmiş approved dersleri otomatik tamamla, ardından istatistikleri tazele
  useEffect(() => {
    const supabase = createClient()
    supabase.rpc('auto_complete_past_lessons').then(() => {
      loadSchedule(currentDate)
      refreshCurrentMonthStats()
    })
  }, [])

  const loadSchedule = async (dateKey: string) => {
    setScheduleLoading(true)
    const supabase = createClient()

    const [{ data: resData }, { data: scheduleData }, { data: dailyShiftData }] = await Promise.all([
      supabase.from('reservations')
        .select('id, start_time, end_time, status, type, member_id, members(name, surname)')
        .eq('trainer_id', trainerId)
        .eq('scheduled_date', dateKey)
        .neq('status', 'cancelled'),
      supabase.from('trainer_schedules')
        .select('start_time, is_available')
        .eq('trainer_id', trainerId)
        .eq('scheduled_date', dateKey),
      supabase.from('trainer_daily_shifts')
        .select('shift')
        .eq('trainer_id', trainerId)
        .eq('scheduled_date', dateKey)
        .maybeSingle()
    ])

    setDailyShift(dailyShiftData?.shift ?? null)

    const resMap: Record<string, Reservation> = {}
    for (const r of resData ?? []) {
      const m = Array.isArray(r.members) ? r.members[0] : r.members
      resMap[r.start_time] = {
        id: r.id, start_time: r.start_time, end_time: r.end_time,
        status: r.status, type: r.type, member_id: r.member_id, member_name: m ? `${m.name} ${m.surname}` : 'Bilinmiyor'
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

    // Slot listesi: 1 Haziran 2026 öncesi için sabit tam liste, sonrası için
    // ilk görüntülemede donmuş arşiv (varsa) veya o anki mesaiye göre hesaplanan liste.
    if (dateKey < SLOT_ARCHIVE_CUTOFF) {
      setEffectiveSlots(FULL_SLOTS)
    } else {
      const baseShift = dailyShiftData?.shift ?? shift
      const liveSlots = [
        ...(SHIFT_SLOTS[baseShift] ?? SHIFT_SLOTS.fullday),
        ...EXTRA_SLOTS.filter(s => extra.has(s))
      ]

      if (dateKey <= todayKeyIstanbul()) {
        const { data: archiveRow } = await supabase.from('trainer_daily_slot_archive')
          .select('slots')
          .eq('trainer_id', trainerId)
          .eq('scheduled_date', dateKey)
          .maybeSingle()

        if (archiveRow?.slots) {
          setEffectiveSlots(archiveRow.slots as string[])
        } else {
          await supabase.from('trainer_daily_slot_archive')
            .upsert({ trainer_id: trainerId, scheduled_date: dateKey, slots: liveSlots }, { onConflict: 'trainer_id,scheduled_date' })
          setEffectiveSlots(liveSlots)
        }
      } else {
        setEffectiveSlots(liveSlots)
      }
    }

    setScheduleLoading(false)
  }

  const loadMembers = async () => {
    setMembersLoading(true)
    const supabase = createClient()

    // Her zaman sadece atanmış öğrenciler
    let memberIds: string[] = []
    const { data: assignedData } = await supabase.from('member_allowed_trainers').select('member_id').eq('trainer_id', trainerId)
    memberIds = (assignedData ?? []).map((r: any) => r.member_id)
    if (memberIds.length === 0) { setMembers([]); setMembersLoading(false); return }

    const { data: membersData } = await supabase
      .from('members').select('id, user_id, name, surname').in('id', memberIds).is('deleted_at', null).order('name')

    // Kalan ders hesabı — üye sayfasındaki RPC mantığıyla aynı
    const { data: ownMs } = await supabase.from('memberships').select('id, member_id, total_lessons').in('member_id', memberIds).is('family_id', null)
    const { data: famMs } = await supabase.from('memberships').select('id, family_id, total_lessons').not('family_id', 'is', null)
    const { data: famMemberRows } = await supabase.from('family_members').select('family_id, member_id').in('member_id', memberIds)

    const ownTotalMap = new Map<string, number>()
    for (const m of ownMs ?? []) ownTotalMap.set(m.member_id, (ownTotalMap.get(m.member_id) ?? 0) + m.total_lessons)
    const memberFamMap = new Map<string, string>()
    for (const fm of famMemberRows ?? []) memberFamMap.set(fm.member_id, fm.family_id)

    // Kişisel paket kullanımı (sadece family_id=null paketlere bağlı rezervasyonlar)
    const ownMsIds = (ownMs ?? []).map((m: any) => m.id)
    const [{ data: ownUsedRes }, { data: ownReservedRes }] = await Promise.all(
      ownMsIds.length > 0 ? [
        supabase.from('reservations').select('member_id').in('membership_id', ownMsIds).in('status', ['completed','no_show']),
        supabase.from('reservations').select('member_id').in('membership_id', ownMsIds).in('status', ['pending','approved']),
      ] : [{ data: [] }, { data: [] }]
    )
    const ownUsedMap = new Map<string, number>()
    for (const r of ownUsedRes ?? []) ownUsedMap.set(r.member_id, (ownUsedMap.get(r.member_id) ?? 0) + 1)
    const ownResMap = new Map<string, number>()
    for (const r of ownReservedRes ?? []) ownResMap.set(r.member_id, (ownResMap.get(r.member_id) ?? 0) + 1)

    // Aile havuzu: tüm aile üyelerinin ortak kullanımı family_id bazında
    const msIdToFamId = new Map<string, string>()
    const famTotalMap = new Map<string, number>()
    for (const m of famMs ?? []) {
      msIdToFamId.set(m.id, m.family_id)
      famTotalMap.set(m.family_id, (famTotalMap.get(m.family_id) ?? 0) + m.total_lessons)
    }
    const famMsIds = (famMs ?? []).map((m: any) => m.id)
    const [{ data: famPoolUsedRes }, { data: famPoolResRes }] = await Promise.all(
      famMsIds.length > 0 ? [
        supabase.from('reservations').select('membership_id').in('membership_id', famMsIds).in('status', ['completed','no_show']),
        supabase.from('reservations').select('membership_id').in('membership_id', famMsIds).in('status', ['pending','approved']),
      ] : [{ data: [] }, { data: [] }]
    )
    const famPoolUsedMap = new Map<string, number>()
    for (const r of famPoolUsedRes ?? []) {
      const fid = msIdToFamId.get(r.membership_id); if (fid) famPoolUsedMap.set(fid, (famPoolUsedMap.get(fid) ?? 0) + 1)
    }
    const famPoolResMap = new Map<string, number>()
    for (const r of famPoolResRes ?? []) {
      const fid = msIdToFamId.get(r.membership_id); if (fid) famPoolResMap.set(fid, (famPoolResMap.get(fid) ?? 0) + 1)
    }
    const famRemainingMap = new Map<string, number>()
    for (const [fid, total] of famTotalMap) {
      famRemainingMap.set(fid, total - (famPoolUsedMap.get(fid) ?? 0) - (famPoolResMap.get(fid) ?? 0))
    }

    const mapped = (membersData ?? []).map((m: any) => {
      const famId = memberFamMap.get(m.id)
      const ownRemaining = (ownTotalMap.get(m.id) ?? 0) - (ownUsedMap.get(m.id) ?? 0) - (ownResMap.get(m.id) ?? 0)
      const famRemaining = famId ? (famRemainingMap.get(famId) ?? 0) : 0
      return { id: m.id, user_id: m.user_id, name: m.name, surname: m.surname, remaining_lessons: ownRemaining + famRemaining }
    })
    setMembers(mapped)

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
      showFeedback(`${member.name} ${member.surname} adlı üyenin dersi kalmamış.`, false)
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
    if (error) showFeedback('Hata: ' + error.message, false)
    else { showFeedback(`${member.name} için ders eklendi ✓`, true); await loadSchedule(currentDate); await loadMembers() }
    setActionLoading(false)
  }

  const [cancelTarget, setCancelTarget] = useState<string | null>(null)

  const handleCancelReservation = async () => {
    if (!cancelTarget) return
    setActionLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.rpc('admin_cancel_reservation', { p_reservation_id: cancelTarget })
    setCancelTarget(null)
    setSelectedSlot(null)
    setSlotAction(null)
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

    // Bu gün için donmuş bir slot arşivi varsa, ekstra slot değişikliğini orada da yansıt
    if (currentDate >= SLOT_ARCHIVE_CUTOFF) {
      const { data: archiveRow } = await supabase.from('trainer_daily_slot_archive')
        .select('slots')
        .eq('trainer_id', trainerId).eq('scheduled_date', currentDate)
        .maybeSingle()

      if (archiveRow?.slots) {
        const current = archiveRow.slots as string[]
        const updated = currentlyOpen
          ? current.filter(s => s !== slot)
          : [...current, slot].sort()
        await supabase.from('trainer_daily_slot_archive')
          .update({ slots: updated })
          .eq('trainer_id', trainerId).eq('scheduled_date', currentDate)
      }
    }

    await loadSchedule(currentDate)
    setActionLoading(false)
  }

  const markLesson = async (reservationId: string, slot: string, status: 'completed' | 'no_show') => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.rpc('mark_attendance', { p_reservation_id: reservationId, p_status: status, p_marked_by: user?.id })
    setLocalStatuses(prev => ({ ...prev, [slot]: status }))
    setSelectedSlot(null)
    setSlotAction(null)
    await loadMembers()
  }

  const handleMarkNoShow = async (reservationId: string, slot: string) => {
    setActionLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    // mark_attendance hem approved→no_show hem completed→no_show geçişini destekliyor
    await supabase.rpc('mark_attendance', { p_reservation_id: reservationId, p_status: 'no_show', p_marked_by: user?.id })
    setLocalStatuses(prev => ({ ...prev, [slot]: 'no_show' }))
    setSelectedSlot(null)
    setSlotAction(null)
    await loadSchedule(currentDate)
    await loadMembers()
    setActionLoading(false)
  }

  const handleAdminCancelCompleted = async (reservationId: string) => {
    setActionLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.rpc('admin_cancel_completed_lesson', { p_admin_id: user?.id, p_reservation_id: reservationId })
    setSelectedSlot(null)
    setSlotAction(null)
    await loadSchedule(currentDate)
    await loadMembers()
    setActionLoading(false)
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

  const saveDailyShift = async (newShift: string | null) => {
    setDailyShiftSaving(true)
    const supabase = createClient()
    if (newShift === null) {
      await supabase.from('trainer_daily_shifts').delete()
        .eq('trainer_id', trainerId).eq('scheduled_date', currentDate)
    } else {
      await supabase.from('trainer_daily_shifts').upsert({
        trainer_id: trainerId, scheduled_date: currentDate, shift: newShift
      }, { onConflict: 'trainer_id,scheduled_date' })
    }
    setDailyShift(newShift)
    setShowShiftPicker(false)
    setDailyShiftSaving(false)
  }

  const nowMonthKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`
  const currentMonth = MONTHS_TR[today.getMonth()]
  const nextMonthName = MONTHS_TR[(today.getMonth() + 1) % 12]

  // Canlı stat sayaçları — auto_complete sonrası tazelenir, öncesinde boş göster
  const [liveReserved, setLiveReserved] = useState<number | null>(null)
  const [yapilanMonth, setYapilanMonth] = useState(nowMonthKey)
  const [yapilanCount, setYapilanCount] = useState<number | null>(null)
  const [yapilanLoading, setYapilanLoading] = useState(false)

  const refreshCurrentMonthStats = async () => {
    const supabase = createClient()
    const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
    const monthEnd = nowMonthKey === `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`
      ? (() => { const nd = new Date(today.getFullYear(), today.getMonth()+1, 1); return `${nd.getFullYear()}-${String(nd.getMonth()+1).padStart(2,'0')}-01` })()
      : `${today.getFullYear()}-${String(today.getMonth()+2).padStart(2,'0')}-01`
    const monthStart = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-01`
    const [{ count: resCount }, { count: doneCount }] = await Promise.all([
      supabase.from('reservations').select('id', { count: 'exact', head: true })
        .eq('trainer_id', trainerId).gte('scheduled_date', todayKey).lt('scheduled_date', monthEnd).in('status', ['pending','approved']),
      supabase.from('reservations').select('id', { count: 'exact', head: true })
        .eq('trainer_id', trainerId).gte('scheduled_date', monthStart).lt('scheduled_date', monthEnd).in('status', ['completed','no_show']),
    ])
    setLiveReserved(resCount ?? 0)
    // Sadece bu aydaysak yapılan sayacını da güncelle
    if (yapilanMonth === nowMonthKey) setYapilanCount(doneCount ?? 0)
  }

  const loadYapilanStats = async (month: string) => {
    setYapilanLoading(true)
    const [y, m] = month.split('-').map(Number)
    const start = `${y}-${String(m).padStart(2,'0')}-01`
    const nd = m === 12 ? new Date(y+1, 0, 1) : new Date(y, m, 1)
    const end = `${nd.getFullYear()}-${String(nd.getMonth()+1).padStart(2,'0')}-01`
    const supabase = createClient()
    const { count } = await supabase.from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('trainer_id', trainerId)
      .gte('scheduled_date', start)
      .lt('scheduled_date', end)
      .in('status', ['completed', 'no_show'])
    setYapilanCount(count ?? 0)
    setYapilanLoading(false)
  }

  const changeYapilanMonth = (dir: number) => {
    const [y, m] = yapilanMonth.split('-').map(Number)
    const nd = new Date(y, m-1+dir, 1)
    const newMonth = `${nd.getFullYear()}-${String(nd.getMonth()+1).padStart(2,'0')}`
    if (newMonth > nowMonthKey) return
    setYapilanMonth(newMonth)
    loadYapilanStats(newMonth)
  }

  const yapilanMonthName = MONTHS_TR[parseInt(yapilanMonth.split('-')[1]) - 1]

  const visibleSlots = effectiveSlots

  // Henüz listede olmayan ekstra slotlar (22:30 / 23:00) — "Slotu Aç" butonu için
  const closedExtraSlots = EXTRA_SLOTS.filter(s => !effectiveSlots.includes(s))

  const selectedRes = selectedSlot ? reservations[selectedSlot] : undefined
  const selectedClosed = selectedSlot ? closedSlots.has(selectedSlot) : false
  const selectedCurrentStatus = selectedSlot ? (localStatuses[selectedSlot] ?? selectedRes?.status) : undefined

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: '#FBFBFB' }}
    >
      {/* Header */}
      <div className="px-5 pt-4 pb-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(27,59,47,0.06)', border: '2px solid rgba(245,158,11,0.4)' }}
          >
            <span className="text-2xl">🏇</span>
          </div>
          <a href={isAdminView ? `/admin/trainers/${trainerId}/profile-edit` : `/trainer/profile-edit`}
            className="block">
            <p className="text-[10px] font-medium tracking-widest" style={{ color: 'rgba(27,59,47,0.55)' }}>Hoş geldin</p>
            <h1 className="text-2xl font-bold">{trainerName}</h1>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <p className="text-xs font-medium" style={{ color: '#f59e0b' }}>Eğitmen ✏️</p>
            </div>
          </a>
        </div>
        <button
          onClick={() => setShowShiftPicker(true)}
          className="text-xs font-bold px-3 py-2 rounded-2xl"
          style={{ background: 'rgba(27,59,47,0.08)', color: '#1B3B2F', border: '1px solid rgba(27,59,47,0.12)' }}
        >
          Slotlar
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-bold mx-4"
          style={{ background: 'rgba(248,113,113,0.2)', border: '1px solid rgba(248,113,113,0.4)', backdropFilter: 'blur(8px)' }}>
          {toast}
        </div>
      )}

      {/* Stat cards 3x2 */}
      <div className="grid grid-cols-3 gap-1.5 px-5 mb-2 flex-shrink-0">
        {/* Günün dersleri */}
        <div className="rounded-xl flex flex-col items-center justify-center"
          style={{ background: 'rgba(27,59,47,0.06)', border: '1px solid rgba(27,59,47,0.10)', padding: '6px 6px', height: 52 }}>
          <p className="text-[8px] font-medium uppercase tracking-wide leading-tight mb-1 text-center" style={{ color: 'rgba(27,59,47,0.55)' }}>Günün dersleri</p>
          <p className="text-base font-bold text-center" style={{ color: '#1B3B2F' }}>{stats.today_lessons}</p>
        </div>
        {/* Bu ay yapılacak */}
        <div className="rounded-xl flex flex-col items-center justify-center"
          style={{ background: 'rgba(27,59,47,0.06)', border: '1px solid rgba(27,59,47,0.10)', padding: '6px 6px', height: 52 }}>
          <p className="text-[8px] font-medium uppercase tracking-wide leading-tight mb-1 text-center" style={{ color: 'rgba(27,59,47,0.55)' }}>{currentMonth} yapılacak</p>
          <p className="text-base font-bold text-center" style={{ color: '#1B3B2F' }}>{liveReserved === null ? '…' : liveReserved}</p>
        </div>
        {/* Sonraki ay yapılacak */}
        <div className="rounded-xl flex flex-col items-center justify-center"
          style={{ background: 'rgba(27,59,47,0.06)', border: '1px solid rgba(27,59,47,0.10)', padding: '6px 6px', height: 52 }}>
          <p className="text-[8px] font-medium uppercase tracking-wide leading-tight mb-1 text-center" style={{ color: 'rgba(27,59,47,0.55)' }}>{nextMonthName} yapılacak</p>
          <p className="text-base font-bold text-center" style={{ color: '#38bdf8' }}>{stats.next_month_reserved}</p>
        </div>
        {/* Yapılan — ay navigasyonlu */}
        <div className="rounded-xl flex flex-col items-center justify-center col-span-1"
          style={{ background: 'rgba(27,59,47,0.06)', border: '1px solid rgba(27,59,47,0.10)', padding: '4px 4px', height: 52 }}>
          <p className="text-[8px] font-medium uppercase tracking-wide leading-tight text-center" style={{ color: 'rgba(27,59,47,0.55)' }}>{yapilanMonthName} yapılan</p>
          <div className="flex items-center gap-1 mt-1">
            <button onClick={() => changeYapilanMonth(-1)} className="text-[10px] px-1" style={{ color: 'rgba(27,59,47,0.55)' }}>←</button>
            <p className="text-base font-bold text-center w-6" style={{ color: '#34d399' }}>{yapilanLoading || yapilanCount === null ? '…' : yapilanCount}</p>
            <button onClick={() => changeYapilanMonth(1)} className="text-[10px] px-1"
              style={{ color: yapilanMonth >= nowMonthKey ? 'rgba(123,147,196,0.3)' : 'rgba(27,59,47,0.55)' }}>→</button>
          </div>
        </div>
        {/* Prim */}
        <div className="rounded-xl flex flex-col items-center justify-center"
          style={{ background: 'rgba(27,59,47,0.06)', border: '1px solid rgba(27,59,47,0.10)', padding: '6px 6px', height: 52 }}>
          <p className="text-[8px] font-medium uppercase tracking-wide leading-tight mb-1 text-center" style={{ color: 'rgba(27,59,47,0.55)' }}>{currentMonth} prim</p>
          <p className="text-base font-bold text-center" style={{ color: '#f59e0b' }}>{Math.round(stats.monthly_prim ?? 0).toLocaleString('tr-TR')}₺</p>
        </div>
        {/* Öğrencilerim */}
        <button onClick={() => setShowStudents(p => !p)}
          className="rounded-xl flex flex-col items-center justify-center"
          style={{ background: 'rgba(27,59,47,0.06)', border: '1px solid rgba(27,59,47,0.10)', padding: '6px 6px', height: 52 }}>
          <p className="text-[8px] font-medium uppercase tracking-wide leading-tight mb-1 text-center" style={{ color: 'rgba(27,59,47,0.55)' }}>Öğrencilerim</p>
          <p className="text-base font-bold text-center" style={{ color: '#1B3B2F' }}>{members.length}</p>
        </button>
      </div>

      {/* Tarih nav */}
      <div className="flex items-center justify-between px-5 mb-2 flex-shrink-0">
        <button onClick={() => changeDate(-1)}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold"
          style={{ background: 'rgba(27,59,47,0.06)', color: 'rgba(27,59,47,0.55)', border: '1px solid rgba(27,59,47,0.10)' }}>
          ←
        </button>
        <div className="text-center">
          <p className="text-sm font-bold">{formatDayLabel(currentDate)}</p>
          {!scheduleLoading && (
            <p className="text-[11px] font-medium" style={{ color: '#f59e0b' }}>
              {Object.keys(reservations).length > 0
                ? `(${Object.keys(reservations).length} ders)`
                : 'ders yok'}
              {dailyShift && ` · ${SHIFT_LABELS[dailyShift] ?? dailyShift}`}
            </p>
          )}
        </div>
        <button onClick={() => changeDate(1)}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold"
          style={{ background: 'rgba(27,59,47,0.06)', color: 'rgba(27,59,47,0.55)', border: '1px solid rgba(27,59,47,0.10)' }}>
          →
        </button>
      </div>

      {/* Slot grid */}
      <div className="flex-1 px-5 pb-24">
        {scheduleLoading
          ? <p className="text-center py-8 text-sm" style={{ color: 'rgba(27,59,47,0.55)' }}>Yükleniyor...</p>
          : (
            <div className="grid grid-cols-2 gap-1">
              {visibleSlots.map(slot => {
                const res = reservations[slot]
                const isClosed = closedSlots.has(slot)
                const isExtra = openExtraSlots.has(slot)
                const past = isSlotPast(currentDate, slot)
                const currentStatus = localStatuses[slot] ?? res?.status
                const isSelected = selectedSlot === slot

                let bg = 'rgba(27,59,47,0.04)'
                let borderColor = 'rgba(27,59,47,0.08)'
                let timeColor = past && !res && !isClosed ? 'rgba(27,59,47,0.3)' : '#1B3B2F'
                let subText = ''
                let subColor = '#34d399'

                if (res) {
                  // Turuncu: saati gelmiş (past) VEYA zaten completed
                  // Kırmızı: gelmedi (no_show)
                  // Nötr: henüz gelmemiş (future, approved/pending)
                  const isOrangeSlot = (past || currentStatus === 'completed') && currentStatus !== 'no_show' && currentStatus !== 'cancelled'
                  bg = currentStatus === 'no_show' ? 'rgba(248,113,113,0.08)' :
                       isOrangeSlot                ? 'rgba(245,158,11,0.10)'  : 'rgba(27,59,47,0.08)'
                  borderColor = currentStatus === 'no_show' ? 'rgba(248,113,113,0.25)' :
                                isOrangeSlot                 ? 'rgba(245,158,11,0.35)'  : 'rgba(27,59,47,0.15)'
                  subText = res.member_name.split(' ')[0]
                  subColor = currentStatus === 'no_show' ? '#f87171' :
                             isOrangeSlot                 ? '#f59e0b' : '#1B3B2F'
                } else if (isClosed) {
                  bg = 'rgba(27,59,47,0.02)'
                  timeColor = 'rgba(27,59,47,0.3)'
                  subText = 'Kapalı'
                  subColor = 'rgba(27,59,47,0.35)'
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
                    onClick={() => (!past || isAdminView || res || isClosed || isExtra) ? handleSlotClick(slot) : undefined}
                    disabled={past && !isAdminView && !res && !isClosed && !isExtra}
                    className="flex items-center justify-between px-3 rounded-lg transition-all text-left"
                    style={{
                      background: isSelected ? 'rgba(27,59,47,0.14)' : bg,
                      border: `1px solid ${isSelected ? 'rgba(27,59,47,0.30)' : borderColor}`,
                      cursor: past && !isAdminView && !res && !isClosed && !isExtra ? 'default' : 'pointer',
                      height: 32,
                    }}
                  >
                    <span className="text-[11px] font-bold" style={{ color: timeColor }}>
                      {formatTime(slot)} – {formatTime(addHalfHour(slot))}
                    </span>
                    {subText && (
                      <span className="text-[10px] font-medium truncate ml-1 flex items-center gap-1" style={{ color: subColor, maxWidth: '50%' }}>
                        {res?.type === 'trial' && (
                          <span className="px-1 py-0.5 rounded font-bold text-[9px] flex-shrink-0"
                            style={{ background: 'rgba(245,158,11,0.3)', color: '#f59e0b' }}>DD</span>
                        )}
                        {subText}
                      </span>
                    )}
                  </button>
                )
              })}

            </div>
          )
        }

        {/* Henüz açılmamış ekstra slotlar (22:30 / 23:00) */}
        {!scheduleLoading && (() => {
          const openable = closedExtraSlots.filter(s => !isSlotPast(currentDate, s) || isAdminView)
          return openable.length > 0 ? (
            <div className="flex gap-2 mt-2">
              {openable.map(s => (
                <button key={s} onClick={() => handleToggleExtra(s, false)}
                  disabled={actionLoading}
                  className="flex-1 py-2 rounded-xl text-xs font-bold"
                  style={{ background: 'rgba(52,211,153,0.10)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
                  + {formatTime(s)} Slotunu Aç
                </button>
              ))}
            </div>
          ) : null
        })()}
      </div>

      {/* Slot action bottom sheet */}
      {selectedSlot && slotAction && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.65)' }}
          onClick={() => { setSelectedSlot(null); setSlotAction(null) }}>
          <div
            className="w-full rounded-t-3xl px-5 pt-5 pb-24"
            style={{ background: '#FBFBFB', border: '1px solid rgba(27,59,47,0.10)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <p className="font-bold text-base">{formatTime(selectedSlot)}</p>
              <button onClick={() => { setSelectedSlot(null); setSlotAction(null) }}
                className="w-8 h-8 flex items-center justify-center rounded-full text-lg font-bold"
                style={{ background: 'rgba(27,59,47,0.08)', color: 'rgba(27,59,47,0.55)' }}>✕</button>
            </div>

            {slotAction === 'menu' && (
              <>
                {selectedRes && (() => {
                  const currentStatus = selectedCurrentStatus ?? selectedRes.status
                  const isPast    = isSlotPast(currentDate, selectedSlot)
                  const isNoShow  = currentStatus === 'no_show'
                  // Turuncu: saati gelmiş (past) VEYA completed — gelmedi/iptal değil
                  const isOrange  = (isPast || currentStatus === 'completed') && !isNoShow && currentStatus !== 'cancelled'
                  const isFuture  = !isOrange && !isNoShow && currentStatus !== 'cancelled'
                  return (
                    <div className="space-y-2">
                      <a href={`/admin/members/${selectedRes.member_id}/settings`} className="font-bold hover:underline">{selectedRes.member_name}</a>
                      <p className="text-xs mb-1" style={{ color: isNoShow ? '#f87171' : isOrange ? '#f59e0b' : 'rgba(27,59,47,0.55)' }}>
                        {isNoShow ? 'Gelmedi' : isOrange ? 'Ders saati geldi' : 'Onaylı'}
                      </p>

                      {/* Turuncu: saati gelmiş ders — Gelmedi + İptal */}
                      {isOrange && (
                        <>
                          <button onClick={() => handleMarkNoShow(selectedRes.id, selectedSlot)}
                            disabled={actionLoading}
                            className="w-full py-3 rounded-2xl text-sm font-bold"
                            style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}>
                            Gelmedi
                          </button>
                          <button onClick={() => isAdminView ? handleAdminCancelCompleted(selectedRes.id) : setCancelTarget(selectedRes.id)}
                            disabled={actionLoading}
                            className="w-full py-3 rounded-2xl text-sm font-bold"
                            style={{ background: 'rgba(27,59,47,0.06)', color: '#1B3B2F' }}>
                            İptal Et {isAdminView ? '(ders geri döner)' : ''}
                          </button>
                        </>
                      )}

                      {/* Kırmızı (gelmedi): sadece admin iptal edebilir */}
                      {isNoShow && isAdminView && (
                        <button onClick={() => handleAdminCancelCompleted(selectedRes.id)}
                          disabled={actionLoading}
                          className="w-full py-3 rounded-2xl text-sm font-bold"
                          style={{ background: 'rgba(248,113,113,0.08)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}>
                          İptal Et (ders geri döner)
                        </button>
                      )}

                      {/* Beyaz: saati gelmemiş ders — sadece iptal */}
                      {isFuture && (
                        <button onClick={() => setCancelTarget(selectedRes.id)}
                          disabled={actionLoading}
                          className="w-full py-3 rounded-2xl text-sm font-bold"
                          style={{ background: 'rgba(27,59,47,0.06)', color: '#1B3B2F' }}>
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
                    style={{ background: 'rgba(27,59,47,0.08)', color: '#1B3B2F' }}>
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

                {!selectedRes && !selectedClosed && !openExtraSlots.has(selectedSlot) && (!isSlotPast(currentDate, selectedSlot) || isAdminView) && (
                  <div className="space-y-2">
                    {/* Geçmiş slotta Slotu Kapat çıkmasın */}
                    {!isSlotPast(currentDate, selectedSlot) && (
                      <button onClick={() => handleToggleClosed(selectedSlot, false)}
                        disabled={actionLoading}
                        className="w-full py-3 rounded-2xl text-sm font-bold"
                        style={{ background: 'rgba(27,59,47,0.06)', color: '#1B3B2F', border: '1px solid rgba(27,59,47,0.10)' }}>
                        Slotu Kapat
                      </button>
                    )}
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
                <button onClick={() => setSlotAction('menu')} className="text-sm mb-4" style={{ color: 'rgba(27,59,47,0.55)' }}>
                  ← Geri
                </button>
                <p className="text-sm font-bold mb-3">Öğrenci seç:</p>
                {membersLoading
                  ? <p className="text-sm" style={{ color: 'rgba(27,59,47,0.55)' }}>Yükleniyor...</p>
                  : members.length === 0
                    ? <p className="text-sm" style={{ color: 'rgba(27,59,47,0.55)' }}>Atanmış öğrenci yok.</p>
                    : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {members.map(member => (
                          <button key={member.id}
                            onClick={() => handleBookMember(member)}
                            disabled={actionLoading}
                            className="w-full rounded-2xl p-3 text-left flex justify-between items-center"
                            style={{ background: 'rgba(27,59,47,0.06)', border: '1px solid rgba(27,59,47,0.10)' }}>
                            <p className="text-sm font-bold">{member.name} {member.surname}</p>
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
            className="w-full rounded-t-3xl px-5 pt-5 pb-24"
            style={{ background: '#FBFBFB', border: '1px solid rgba(27,59,47,0.10)', maxHeight: '75vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              {selectedMember ? (
                <button onClick={() => setSelectedMember(null)} className="text-sm flex items-center gap-1" style={{ color: 'rgba(27,59,47,0.55)' }}>
                  ← Geri
                </button>
              ) : (
                <p className="font-bold text-base">Öğrencilerim</p>
              )}
              <button onClick={() => { setShowStudents(false); setSelectedMember(null) }}
                className="w-8 h-8 flex items-center justify-center rounded-full text-lg font-bold"
                style={{ background: 'rgba(27,59,47,0.08)', color: 'rgba(27,59,47,0.55)' }}>✕</button>
            </div>

            {/* Öğrenci listesi */}
            {!selectedMember && (
              membersLoading
                ? <p className="text-sm text-center py-8" style={{ color: 'rgba(27,59,47,0.55)' }}>Yükleniyor...</p>
                : members.length === 0
                  ? <p className="text-sm text-center py-8" style={{ color: 'rgba(27,59,47,0.55)' }}>Atanmış öğrenci yok.</p>
                  : (
                    <div className="space-y-2">
                      {members.map(m => (
                        <button
                          key={m.id}
                          onClick={() => handleMemberClick(m)}
                          className="w-full rounded-2xl px-4 py-3 flex justify-between items-center text-left"
                          style={{ background: 'rgba(27,59,47,0.06)', border: '1px solid rgba(27,59,47,0.10)' }}
                        >
                          <p className="text-sm font-bold">{m.name} {m.surname}</p>
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
                <p className="text-lg font-bold mb-4">{selectedMember.name} {selectedMember.surname}</p>
                {memberStatsLoading
                  ? <p className="text-sm text-center py-8" style={{ color: 'rgba(27,59,47,0.55)' }}>Yükleniyor...</p>
                  : selectedMemberStats && (
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: 'Toplam ders', value: selectedMemberStats.total_lessons, color: '#1B3B2F' },
                        { label: 'Kullanılan', value: selectedMemberStats.used_lessons, color: '#1B3B2F' },
                        { label: 'Kalan ders', value: selectedMemberStats.remaining_lessons, color: '#34d399' },
                        { label: 'Bekleyen', value: selectedMemberStats.reserved_lessons, color: '#38bdf8' },
                      ].map(card => (
                        <div key={card.label} className="rounded-2xl p-3 text-center"
                          style={{ background: 'rgba(27,59,47,0.06)', border: '1px solid rgba(27,59,47,0.10)' }}>
                          <p className="text-[9px] font-medium uppercase tracking-wide mb-1" style={{ color: 'rgba(27,59,47,0.55)' }}>{card.label}</p>
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
        <div className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.65)' }}
          onClick={() => setShowShiftPicker(false)}>
          <div
            className="w-full h-full px-5 pt-5 pb-8 overflow-y-auto"
            style={{ background: '#FBFBFB' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3 sticky top-0 pt-1 -mt-1" style={{ background: '#FBFBFB' }}>
              <p className="font-bold text-base">Slot Seçimi</p>
              <button onClick={() => setShowShiftPicker(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-lg font-bold"
                style={{ background: 'rgba(27,59,47,0.08)', color: 'rgba(27,59,47,0.55)' }}>✕</button>
            </div>
            <p className="text-xs mb-2" style={{ color: 'rgba(27,59,47,0.55)' }}>Seçtiğin slot aralığı tüm günlerde varsayılan olarak uygulanır.</p>
            <div className="space-y-1.5">
              {[
                { key: 'morning', label: '☀️ Sabah', desc: '10:30 — 20:00' },
                { key: 'evening', label: '🌙 Akşam', desc: '15:00 — 22:00' },
                { key: 'fullday', label: '🌅 Tam Gün', desc: '11:00 — 22:00' },
                { key: 'weekend', label: '📅 Hafta Sonu', desc: 'Cmt & Paz' },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => saveShift(opt.key)}
                  disabled={shiftSaving}
                  className="w-full rounded-2xl p-2.5 text-left flex justify-between items-center"
                  style={{
                    background: shift === opt.key ? 'rgba(56,189,248,0.12)' : 'rgba(27,59,47,0.05)',
                    border: `1px solid ${shift === opt.key ? 'rgba(56,189,248,0.35)' : 'rgba(27,59,47,0.10)'}`,
                  }}
                >
                  <div>
                    <p className="text-sm font-bold">{opt.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(27,59,47,0.55)' }}>{opt.desc}</p>
                  </div>
                  {shift === opt.key && <span style={{ color: '#38bdf8' }}>✓</span>}
                </button>
              ))}
            </div>

            <div className="h-px my-3" style={{ background: 'rgba(27,59,47,0.10)' }} />

            <p className="font-bold text-sm mb-1">Sadece bu gün — {formatDayLabel(currentDate)}</p>
            <p className="text-xs mb-2" style={{ color: 'rgba(27,59,47,0.55)' }}>Bu günü farklı bir mesaiye çevir, diğer günler varsayılanı kullanmaya devam eder.</p>
            <div className="space-y-1.5">
              {[
                { key: 'morning', label: '☀️ Sabah', desc: '10:30 — 20:00' },
                { key: 'evening', label: '🌙 Akşam', desc: '15:00 — 22:00' },
                { key: 'fullday', label: '🌅 Tam Gün', desc: '11:00 — 22:00' },
                { key: 'weekend', label: '📅 Hafta Sonu', desc: 'Cmt & Paz' },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => saveDailyShift(opt.key)}
                  disabled={dailyShiftSaving}
                  className="w-full rounded-2xl p-2.5 text-left flex justify-between items-center"
                  style={{
                    background: dailyShift === opt.key ? 'rgba(245,158,11,0.12)' : 'rgba(27,59,47,0.05)',
                    border: `1px solid ${dailyShift === opt.key ? 'rgba(245,158,11,0.35)' : 'rgba(27,59,47,0.10)'}`,
                  }}
                >
                  <div>
                    <p className="text-sm font-bold">{opt.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(27,59,47,0.55)' }}>{opt.desc}</p>
                  </div>
                  {dailyShift === opt.key && <span style={{ color: '#f59e0b' }}>✓</span>}
                </button>
              ))}
              {dailyShift && (
                <button
                  onClick={() => saveDailyShift(null)}
                  disabled={dailyShiftSaving}
                  className="w-full rounded-2xl p-2.5 text-center text-sm font-bold"
                  style={{ background: 'rgba(27,59,47,0.05)', color: 'rgba(27,59,47,0.55)', border: '1px solid rgba(27,59,47,0.10)' }}
                >
                  Varsayılana dön ({SHIFT_LABELS[shift] ?? shift})
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* İptal onay modalı */}
      {cancelTarget && (
        <div className="fixed inset-0 z-[60] flex items-end" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="w-full rounded-t-3xl p-6" style={{ background: '#FBFBFB', border: '1px solid rgba(27,59,47,0.10)' }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'rgba(27,59,47,0.15)' }} />
            <h3 className="text-lg font-bold mb-2">Dersi İptal Et</h3>
            <p className="text-sm mb-6" style={{ color: 'rgba(27,59,47,0.55)' }}>Bu dersi iptal etmek istediğinize emin misiniz?</p>
            <div className="flex gap-3">
              <button onClick={() => setCancelTarget(null)} disabled={actionLoading}
                className="flex-1 py-3 rounded-2xl font-bold text-sm disabled:opacity-50"
                style={{ background: 'rgba(27,59,47,0.08)', color: 'rgba(27,59,47,0.55)' }}>
                Vazgeç
              </button>
              <button onClick={handleCancelReservation} disabled={actionLoading}
                className="flex-1 py-3 rounded-2xl font-bold text-sm disabled:opacity-50"
                style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}>
                {actionLoading ? '...' : 'İptal Et'}
              </button>
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
