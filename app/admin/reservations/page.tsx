'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const MONTHS_TR = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']
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

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]} ${d.getFullYear()}`
}

function formatDayLabel(dateKey: string) {
  const [y,m,d] = dateKey.split('-').map(Number)
  const date = new Date(y, m-1, d)
  return `${DAYS_TR[date.getDay()]}, ${d} ${MONTHS_TR[m-1]}`
}

function formatTime(t: string) { return t?.substring(0,5) ?? '' }

function formatPrice(p: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(p)
}

const STATUS_MAP: Record<string,string> = { pending: 'Beklemede', approved: 'Onaylı', completed: 'Tamamlandı', cancelled: 'İptal', no_show: 'Gelmedi' }

const STATUS_COLOR: Record<string,string> = {
  pending:   'rgba(245,158,11,0.15)',
  approved:  'rgba(56,189,248,0.15)',
  completed: 'rgba(52,211,153,0.15)',
  cancelled: 'rgba(248,113,113,0.15)',
  no_show:   'rgba(251,146,60,0.15)',
}

const STATUS_TEXT: Record<string,string> = {
  pending:   '#f59e0b',
  approved:  '#38bdf8',
  completed: '#34d399',
  cancelled: '#f87171',
  no_show:   '#fb923c',
}

type Reservation = { id: string; scheduled_date: string; start_time: string; end_time: string; status: string; type: string; member_name: string; trainer_name: string }
type SlotReservation = { id: string; member_name: string; member_id: string; status: string; end_time: string; type: string }
type Trainer = { id: string; name: string; surname: string }
type Member = { id: string; name: string; surname: string; remaining_lessons: number }

const CARD = { background: 'rgba(27,59,47,0.06)', border: '1px solid rgba(27,59,47,0.10)' }
const INPUT_STYLE = { background: 'rgba(27,59,47,0.04)', border: '1px solid rgba(27,59,47,0.15)', color: '#1B3B2F' }

export default function ReservationsPage() {
  const [tab, setTab] = useState<'list' | 'calendar'>('list')

  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Tümü')
  const [dateFilter, setDateFilter] = useState('')

  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [selectedTrainer, setSelectedTrainer] = useState('')
  const [currentDate, setCurrentDate] = useState(toDateKey(new Date()))
  const [slotReservations, setSlotReservations] = useState<Record<string, SlotReservation>>({})
  const [closedSlots, setClosedSlots] = useState<Set<string>>(new Set())
  const [calLoading, setCalLoading] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [actionLoading, setActionLoading] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState('')
  const showMsg = (m: string) => { setActionMsg(m); setTimeout(() => setActionMsg(''), 3000) }

  useEffect(() => {
    const supabase = createClient()
    // Geçmiş 'approved' dersleri tamamlandı olarak işaretle, sonra listeyi yükle
    supabase.rpc('auto_complete_past_lessons').then(() => loadReservations())
  }, [])
  useEffect(() => { loadTrainers() }, [])
  useEffect(() => { if (selectedTrainer) loadCalendar() }, [selectedTrainer, currentDate])

  const loadReservations = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from('reservations').select('id, scheduled_date, start_time, end_time, status, type, members(name, surname), trainers(name, surname)').order('scheduled_date', { ascending: false }).limit(200)
    setReservations((data ?? []).map((r: any) => {
      const m = Array.isArray(r.members) ? r.members[0] : r.members
      const t = Array.isArray(r.trainers) ? r.trainers[0] : r.trainers
      return { id: r.id, scheduled_date: r.scheduled_date, start_time: r.start_time, end_time: r.end_time, status: r.status, type: r.type, member_name: m ? `${m.name} ${m.surname}` : 'Bilinmiyor', trainer_name: t ? `${t.name} ${t.surname}` : 'Bilinmiyor' }
    }))
    setLoading(false)
  }

  const loadTrainers = async () => {
    const supabase = createClient()
    const { data } = await supabase.from('trainers').select('id, name, surname').is('deleted_at', null)
    setTrainers(data ?? [])
    if (data && data.length > 0) setSelectedTrainer(data[0].id)
  }

  const loadCalendar = async () => {
    if (!selectedTrainer) return
    setCalLoading(true)
    const supabase = createClient()
    const [{ data: resData }, { data: closedData }] = await Promise.all([
      supabase.from('reservations').select('id, start_time, end_time, status, type, member_id, members(name, surname)').eq('trainer_id', selectedTrainer).eq('scheduled_date', currentDate).neq('status', 'cancelled'),
      supabase.from('trainer_schedules').select('start_time').eq('trainer_id', selectedTrainer).eq('scheduled_date', currentDate).eq('is_available', false),
    ])
    const resMap: Record<string, SlotReservation> = {}
    for (const r of resData ?? []) {
      const m = Array.isArray(r.members) ? r.members[0] : r.members
      resMap[r.start_time] = { id: r.id, member_id: r.member_id, member_name: m ? `${m.name} ${m.surname}` : 'Bilinmiyor', status: r.status, end_time: r.end_time, type: r.type }
    }
    setSlotReservations(resMap)
    setClosedSlots(new Set((closedData ?? []).map((c: any) => c.start_time)))
    setSelectedSlot(null)
    setCalLoading(false)
  }

  const loadMembers = async () => {
    const supabase = createClient()
    const { data: allowedData } = await supabase.from('member_allowed_trainers').select('member_id').eq('trainer_id', selectedTrainer)
    const memberIds = (allowedData ?? []).map((r: any) => r.member_id)
    if (memberIds.length === 0) { setMembers([]); return }
    const [{ data: membersData }, { data: memberships }, { data: activeRes }] = await Promise.all([
      supabase.from('members').select('id, name, surname').in('id', memberIds).is('deleted_at', null),
      supabase.from('memberships').select('id, member_id, total_lessons, used_lessons').in('member_id', memberIds).eq('is_current', true),
      // reserved_lessons sayaç sütunu zamanla sapabiliyor (drift) — gerçek bekleyen/onaylı rezervasyonu canlı say
      supabase.from('reservations').select('membership_id').in('member_id', memberIds).in('status', ['pending', 'approved']),
    ])
    const reservedByMs = new Map<string, number>()
    for (const r of activeRes ?? []) {
      if (!r.membership_id) continue
      reservedByMs.set(r.membership_id, (reservedByMs.get(r.membership_id) ?? 0) + 1)
    }
    const remainingMap = new Map<string, number>()
    for (const m of memberships ?? []) {
      const reserved = reservedByMs.get(m.id) ?? 0
      remainingMap.set(m.member_id, (remainingMap.get(m.member_id) ?? 0) + (m.total_lessons - m.used_lessons - reserved))
    }
    setMembers((membersData ?? []).map((m: any) => ({ id: m.id, name: m.name, surname: m.surname, remaining_lessons: remainingMap.get(m.id) ?? 0 })))
  }

  const handleSlotClick = (slot: string) => {
    setSelectedSlot(slot === selectedSlot ? null : slot)
    if (!slotReservations[slot] && !closedSlots.has(slot)) loadMembers()
  }

  const handleBookMember = async (member: Member) => {
    if (member.remaining_lessons <= 0) return
    setActionLoading(true)
    const supabase = createClient()
    const endTime = new Date(`2000-01-01T${selectedSlot!}`)
    endTime.setMinutes(endTime.getMinutes() + 30)
    const { error } = await supabase.rpc('trainer_create_reservation', { p_member_id: member.id, p_trainer_id: selectedTrainer, p_scheduled_date: currentDate, p_start_time: selectedSlot!, p_end_time: endTime.toTimeString().substring(0, 8) })
    if (error) showMsg('Hata: ' + error.message)
    else await loadCalendar()
    setActionLoading(false)
  }

  const handleCancel = async () => {
    if (!cancelTarget) return
    setActionLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.rpc('admin_cancel_reservation', { p_reservation_id: cancelTarget })
    setCancelTarget(null)
    await loadCalendar()
    setActionLoading(false)
  }

  const handleStatusChange = async (id: string, status: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (status === 'cancelled') {
      await supabase.rpc('admin_cancel_reservation', { p_reservation_id: id })
    } else if (status === 'completed' || status === 'no_show') {
      await supabase.rpc('mark_attendance', { p_reservation_id: id, p_status: status, p_marked_by: user?.id })
    } else {
      await supabase.rpc('admin_update_reservation', { p_admin_id: user?.id, p_reservation_id: id, p_status: status })
    }
    await loadReservations()
  }

  const handleToggleClosed = async (slot: string, currentlyClosed: boolean) => {
    setActionLoading(true)
    const supabase = createClient()
    if (currentlyClosed) {
      await supabase.from('trainer_schedules').delete().eq('trainer_id', selectedTrainer).eq('scheduled_date', currentDate).eq('start_time', slot)
    } else {
      const endTime = new Date(`2000-01-01T${slot}`)
      endTime.setMinutes(endTime.getMinutes() + 30)
      await supabase.from('trainer_schedules').insert({ trainer_id: selectedTrainer, scheduled_date: currentDate, start_time: slot, end_time: endTime.toTimeString().substring(0, 8), is_available: false })
    }
    await loadCalendar()
    setActionLoading(false)
  }

  const changeDate = (dir: number) => {
    const [y,m,d] = currentDate.split('-').map(Number)
    const date = new Date(y, m-1, d)
    date.setDate(date.getDate() + dir)
    setCurrentDate(toDateKey(date))
  }

  const filtered = reservations.filter(r => {
    const matchSearch = `${r.member_name} ${r.trainer_name}`.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'Tümü' || STATUS_MAP[r.status] === statusFilter
    const matchDate = !dateFilter || r.scheduled_date === dateFilter
    return matchSearch && matchStatus && matchDate
  })

  const selectedRes = selectedSlot ? slotReservations[selectedSlot] : null
  const isClosed = selectedSlot ? closedSlots.has(selectedSlot) : false

  return (
    <div>
      {/* Tab seçici */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Rezervasyonlar</h1>
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(27,59,47,0.06)' }}>
          {(['list','calendar'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-1.5 rounded-lg text-sm font-bold transition-all"
              style={tab === t ? { background: '#f59e0b', color: '#0a0f2e' } : { color: 'rgba(27,59,47,0.55)' }}>
              {t === 'list' ? 'Liste' : 'Takvim'}
            </button>
          ))}
        </div>
      </div>

      {/* LİSTE */}
      {tab === 'list' && (
        <>
          <div className="space-y-3 mb-6">
            <div className="flex gap-2">
              <input type="text" placeholder="Üye veya eğitmen ara..." value={search} onChange={e => setSearch(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl text-sm outline-none" style={INPUT_STYLE} />
              <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
                className="px-3 py-3 rounded-xl text-sm outline-none" style={INPUT_STYLE} />
              {dateFilter && (
                <button onClick={() => setDateFilter('')}
                  className="px-3 py-2 rounded-xl text-xs font-bold"
                  style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171' }}>✕</button>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {['Tümü','Beklemede','Onaylı','Tamamlandı','İptal','Gelmedi'].map(f => (
                <button key={f} onClick={() => setStatusFilter(f)}
                  className="px-3 py-1 rounded-full text-xs font-bold"
                  style={statusFilter === f ? { background: '#f59e0b', color: '#0a0f2e' } : { background: 'rgba(27,59,47,0.06)', color: 'rgba(27,59,47,0.55)', border: '1px solid rgba(27,59,47,0.10)' }}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="text-center py-8" style={{ color: 'rgba(27,59,47,0.55)' }}>Yükleniyor...</p>
          ) : (
            <div className="space-y-2">
              {filtered.length === 0 && <p style={{ color: 'rgba(27,59,47,0.55)' }}>Rezervasyon bulunamadı.</p>}
              {filtered.map(r => (
                <div key={r.id} className="rounded-2xl p-4" style={r.type === 'trial' ? { background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' } : CARD}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="font-bold">{r.member_name}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'rgba(27,59,47,0.55)' }}>{r.trainer_name}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold" style={{ color: '#1B3B2F' }}>
                        {formatDate(r.scheduled_date)}
                        {r.type === 'trial' && (
                          <span className="ml-1 px-1 py-0.5 rounded font-bold text-[9px]"
                            style={{ background: 'rgba(245,158,11,0.3)', color: '#f59e0b' }}>DD</span>
                        )}
                      </p>
                      <p className="text-xs" style={{ color: 'rgba(27,59,47,0.55)' }}>{formatTime(r.start_time)} — {formatTime(r.end_time)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: STATUS_COLOR[r.status] ?? 'rgba(27,59,47,0.06)', color: STATUS_TEXT[r.status] ?? '#1B3B2F' }}>
                      {STATUS_MAP[r.status] ?? r.status}
                    </span>
                    <select value={r.status} onChange={e => handleStatusChange(r.id, e.target.value)}
                      className="text-xs px-2 py-1.5 rounded-lg outline-none" style={INPUT_STYLE}>
                      <option value="pending">Beklemede</option>
                      <option value="approved">Onaylı</option>
                      <option value="completed">Tamamlandı</option>
                      <option value="cancelled">İptal</option>
                      <option value="no_show">Gelmedi</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* TAKVİM */}
      {tab === 'calendar' && (
        <div>
          {/* Eğitmen + tarih nav */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <select value={selectedTrainer} onChange={e => setSelectedTrainer(e.target.value)}
              className="flex-1 px-4 py-2 rounded-xl text-sm outline-none" style={INPUT_STYLE}>
              {trainers.map(t => <option key={t.id} value={t.id}>{t.name} {t.surname}</option>)}
            </select>
            <div className="flex items-center gap-2">
              <button onClick={() => changeDate(-1)} className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: 'rgba(27,59,47,0.06)', color: 'rgba(27,59,47,0.55)' }}>←</button>
              <p className="text-sm font-bold w-40 text-center">{formatDayLabel(currentDate)}</p>
              <button onClick={() => changeDate(1)} className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: 'rgba(27,59,47,0.06)', color: 'rgba(27,59,47,0.55)' }}>→</button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-4">
            {/* Slot listesi */}
            <div className="flex-1">
              {calLoading ? (
                <p className="text-center py-8" style={{ color: 'rgba(27,59,47,0.55)' }}>Yükleniyor...</p>
              ) : (
                <div className="space-y-1.5">
                  {SLOTS.map(slot => {
                    const res = slotReservations[slot]
                    const closed = closedSlots.has(slot)
                    const isSelected = selectedSlot === slot

                    let bg = isSelected ? 'rgba(245,158,11,0.12)' : 'rgba(27,59,47,0.04)'
                    let border = isSelected ? '1px solid rgba(245,158,11,0.35)' : '1px solid rgba(27,59,47,0.08)'

                    if (res) {
                      bg = res.status === 'completed' ? 'rgba(52,211,153,0.10)' : res.status === 'no_show' ? 'rgba(248,113,113,0.10)' : 'rgba(56,189,248,0.10)'
                      border = res.status === 'completed' ? '1px solid rgba(52,211,153,0.25)' : res.status === 'no_show' ? '1px solid rgba(248,113,113,0.25)' : '1px solid rgba(56,189,248,0.25)'
                      if (res.type === 'trial') { bg = 'rgba(245,158,11,0.15)'; border = '1px solid rgba(245,158,11,0.4)' }
                    } else if (closed) {
                      bg = 'rgba(27,59,47,0.02)'
                      border = '1px solid rgba(27,59,47,0.04)'
                    }

                    return (
                      <button key={slot} onClick={() => handleSlotClick(slot)}
                        className="w-full flex items-center gap-4 px-4 py-2.5 rounded-xl transition-all text-left"
                        style={{ background: bg, border }}>
                        <span className="text-sm font-bold w-12 flex-shrink-0" style={{ color: 'rgba(27,59,47,0.55)' }}>
                          {formatTime(slot)}
                          {res?.type === 'trial' && (
                            <span className="ml-1 px-1 py-0.5 rounded font-bold text-[9px]"
                              style={{ background: 'rgba(245,158,11,0.3)', color: '#f59e0b' }}>DD</span>
                          )}
                        </span>
                        {res ? (
                          <div className="flex-1 flex items-center justify-between gap-2">
                            <span className="text-sm font-bold truncate">
                              {res.member_name}
                            </span>
                            <span className="text-xs font-bold flex-shrink-0" style={{ color: STATUS_TEXT[res.status] ?? '#1B3B2F' }}>{STATUS_MAP[res.status]}</span>
                          </div>
                        ) : closed ? (
                          <span className="text-xs" style={{ color: 'rgba(27,59,47,0.4)' }}>Kapalı</span>
                        ) : (
                          <span className="text-xs" style={{ color: '#34d399' }}>Müsait</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Aksiyon paneli */}
            {selectedSlot && (
              <div className="lg:w-64 lg:flex-shrink-0 rounded-2xl p-4" style={CARD}>
                <div className="flex justify-between items-center mb-4">
                  <p className="font-bold">
                    {formatTime(selectedSlot)}
                    {selectedRes?.type === 'trial' && (
                      <span className="ml-1 px-1 py-0.5 rounded font-bold text-[9px]"
                        style={{ background: 'rgba(245,158,11,0.3)', color: '#f59e0b' }}>DD</span>
                    )}
                  </p>
                  <button onClick={() => setSelectedSlot(null)} style={{ color: 'rgba(27,59,47,0.55)' }}>✕</button>
                </div>

                {selectedRes ? (
                  <div className="space-y-3">
                    <p className="font-bold text-sm">
                      {selectedRes.member_name}
                    </p>
                    <p className="text-xs font-bold px-2 py-1 rounded-lg inline-block" style={{ background: STATUS_COLOR[selectedRes.status], color: STATUS_TEXT[selectedRes.status] }}>
                      {STATUS_MAP[selectedRes.status]}
                    </p>
                    <select value={selectedRes.status}
                      onChange={async e => {
                        await handleStatusChange(selectedRes.id, e.target.value)
                        await loadCalendar()
                      }}
                      className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={INPUT_STYLE}>
                      <option value="pending">Beklemede</option>
                      <option value="approved">Onaylı</option>
                      <option value="completed">Tamamlandı</option>
                      <option value="cancelled">İptal</option>
                      <option value="no_show">Gelmedi</option>
                    </select>
                    <button onClick={() => setCancelTarget(selectedRes.id)} disabled={actionLoading}
                      className="w-full py-2 rounded-xl text-sm font-bold disabled:opacity-50"
                      style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}>
                      İptal Et
                    </button>
                  </div>
                ) : isClosed ? (
                  <button onClick={() => handleToggleClosed(selectedSlot, true)} disabled={actionLoading}
                    className="w-full py-2 rounded-xl text-sm font-bold disabled:opacity-50"
                    style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
                    Slotu Aç
                  </button>
                ) : (
                  <div className="space-y-3">
                    <button onClick={() => handleToggleClosed(selectedSlot, false)} disabled={actionLoading}
                      className="w-full py-2 rounded-xl text-sm font-bold disabled:opacity-50"
                      style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}>
                      Slotu Kapat
                    </button>
                    <p className="text-xs font-bold" style={{ color: 'rgba(27,59,47,0.55)' }}>Ders Koy:</p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {members.length === 0
                        ? <p className="text-xs" style={{ color: 'rgba(27,59,47,0.4)' }}>Atanmış üye yok.</p>
                        : members.map(m => (
                          <button key={m.id} onClick={() => handleBookMember(m)} disabled={actionLoading || m.remaining_lessons <= 0}
                            className="w-full rounded-xl p-2.5 text-left disabled:opacity-40"
                            style={CARD}>
                            <p className="text-xs font-bold">{m.name} {m.surname}</p>
                            <p className="text-xs mt-0.5" style={{ color: m.remaining_lessons <= 0 ? '#f87171' : '#34d399' }}>
                              {m.remaining_lessons <= 0 ? 'Ders yok' : `${m.remaining_lessons} ders`}
                            </p>
                          </button>
                        ))
                      }
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {cancelTarget && (
        <div className="fixed inset-0 z-[70] flex items-end" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="w-full rounded-t-3xl p-6" style={{ background: '#FBFBFB', border: '1px solid rgba(27,59,47,0.12)' }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'rgba(27,59,47,0.12)' }} />
            <h3 className="text-lg font-bold mb-2">Rezervasyonu İptal Et</h3>
            <p className="text-sm mb-6" style={{ color: 'rgba(27,59,47,0.55)' }}>Bu rezervasyonu iptal etmek istediğinize emin misiniz?</p>
            <div className="flex gap-3">
              <button onClick={() => setCancelTarget(null)} disabled={actionLoading}
                className="flex-1 py-3 rounded-2xl font-bold text-sm disabled:opacity-50"
                style={{ background: 'rgba(27,59,47,0.08)', color: 'rgba(27,59,47,0.55)' }}>Vazgeç</button>
              <button onClick={handleCancel} disabled={actionLoading}
                className="flex-1 py-3 rounded-2xl font-bold text-sm disabled:opacity-50"
                style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}>
                {actionLoading ? '...' : 'İptal Et'}
              </button>
            </div>
          </div>
        </div>
      )}

      {actionMsg && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[80] px-5 py-3 rounded-2xl text-sm font-bold"
          style={{ background: 'rgba(248,113,113,0.2)', border: '1px solid rgba(248,113,113,0.4)' }}>
          {actionMsg}
        </div>
      )}
    </div>
  )
}
