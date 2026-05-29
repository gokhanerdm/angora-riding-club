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
  return `${DAYS_TR[date.getDay()]}, ${d} ${MONTHS_TR[m-1]} ${y}`
}

function formatTime(t: string) { return t?.substring(0,5) ?? '' }

function formatPrice(p: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(p)
}

const STATUS_MAP: Record<string,string> = {
  pending: 'Beklemede', approved: 'Onaylı', completed: 'Tamamlandı',
  cancelled: 'İptal', no_show: 'Gelmedi'
}
const STATUS_COLOR: Record<string,string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  no_show: 'bg-orange-100 text-orange-700'
}

type Reservation = {
  id: string
  scheduled_date: string
  start_time: string
  end_time: string
  status: string
  type: string
  member_name: string
  trainer_name: string
}

type SlotReservation = {
  id: string
  member_name: string
  member_id: string
  status: string
  end_time: string
}

type Trainer = { id: string; name: string; surname: string }
type Member = { id: string; name: string; surname: string; remaining_lessons: number }

export default function ReservationsPage() {
  const [tab, setTab] = useState<'list' | 'calendar'>('list')

  // Liste state
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Tümü')
  const [dateFilter, setDateFilter] = useState('')

  // Takvim state
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [selectedTrainer, setSelectedTrainer] = useState<string>('')
  const [currentDate, setCurrentDate] = useState(toDateKey(new Date()))
  const [slotReservations, setSlotReservations] = useState<Record<string, SlotReservation>>({})
  const [closedSlots, setClosedSlots] = useState<Set<string>>(new Set())
  const [calLoading, setCalLoading] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => { loadReservations() }, [])
  useEffect(() => { loadTrainers() }, [])
  useEffect(() => { if (selectedTrainer) loadCalendar() }, [selectedTrainer, currentDate])

  const loadReservations = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('reservations')
      .select('id, scheduled_date, start_time, end_time, status, type, members(name, surname), trainers(name, surname)')
      .order('scheduled_date', { ascending: false })
      .limit(200)

    setReservations((data ?? []).map((r: any) => {
      const m = Array.isArray(r.members) ? r.members[0] : r.members
      const t = Array.isArray(r.trainers) ? r.trainers[0] : r.trainers
      return {
        id: r.id, scheduled_date: r.scheduled_date,
        start_time: r.start_time, end_time: r.end_time,
        status: r.status, type: r.type,
        member_name: m ? `${m.name} ${m.surname}` : 'Bilinmiyor',
        trainer_name: t ? `${t.name} ${t.surname}` : 'Bilinmiyor',
      }
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
      supabase.from('reservations')
        .select('id, start_time, end_time, status, member_id, members(name, surname)')
        .eq('trainer_id', selectedTrainer)
        .eq('scheduled_date', currentDate)
        .neq('status', 'cancelled'),
      supabase.from('trainer_schedules')
        .select('start_time')
        .eq('trainer_id', selectedTrainer)
        .eq('scheduled_date', currentDate)
        .eq('is_available', false)
    ])

    const resMap: Record<string, SlotReservation> = {}
    for (const r of resData ?? []) {
      const m = Array.isArray(r.members) ? r.members[0] : r.members
      resMap[r.start_time] = {
        id: r.id, member_id: r.member_id,
        member_name: m ? `${m.name} ${m.surname}` : 'Bilinmiyor',
        status: r.status, end_time: r.end_time
      }
    }

    setSlotReservations(resMap)
    setClosedSlots(new Set((closedData ?? []).map((c: any) => c.start_time)))
    setSelectedSlot(null)
    setCalLoading(false)
  }

  const loadMembers = async () => {
    const supabase = createClient()
    const { data: allowedData } = await supabase
      .from('member_allowed_trainers').select('member_id').eq('trainer_id', selectedTrainer)
    const memberIds = (allowedData ?? []).map((r: any) => r.member_id)
    if (memberIds.length === 0) { setMembers([]); return }

    const [{ data: membersData }, { data: memberships }] = await Promise.all([
      supabase.from('members').select('id, name, surname').in('id', memberIds).is('deleted_at', null),
      supabase.from('memberships').select('member_id, total_lessons, used_lessons, reserved_lessons').in('member_id', memberIds).eq('is_current', true)
    ])

    const remainingMap = new Map<string, number>()
    for (const m of memberships ?? []) {
      remainingMap.set(m.member_id, (remainingMap.get(m.member_id) ?? 0) + (m.total_lessons - m.used_lessons - m.reserved_lessons))
    }
    setMembers((membersData ?? []).map((m: any) => ({
      id: m.id, name: m.name, surname: m.surname,
      remaining_lessons: remainingMap.get(m.id) ?? 0
    })))
  }

  const handleSlotClick = (slot: string) => {
    setSelectedSlot(slot === selectedSlot ? null : slot)
    if (!slotReservations[slot] && !closedSlots.has(slot)) loadMembers()
  }

  const handleBookMember = async (member: Member) => {
    if (member.remaining_lessons <= 0) { alert('Üyenin dersi kalmamış.'); return }
    setActionLoading(true)
    const supabase = createClient()
    const slot = selectedSlot!
    const endTime = new Date(`2000-01-01T${slot}`)
    endTime.setMinutes(endTime.getMinutes() + 30)

    const { error } = await supabase.rpc('trainer_create_reservation', {
      p_member_id: member.id,
      p_trainer_id: selectedTrainer,
      p_scheduled_date: currentDate,
      p_start_time: slot,
      p_end_time: endTime.toTimeString().substring(0, 8),
    })

    if (error) alert('Hata: ' + error.message)
    else await loadCalendar()
    setActionLoading(false)
  }

  const handleCancel = async (reservationId: string) => {
    if (!confirm('Bu rezervasyonu iptal etmek istediğinize emin misiniz?')) return
    setActionLoading(true)
    const supabase = createClient()
    await supabase.from('reservations').update({ status: 'cancelled' }).eq('id', reservationId)
    await loadCalendar()
    setActionLoading(false)
  }

  const handleStatusChange = async (id: string, status: string) => {
    const supabase = createClient()
    await supabase.from('reservations').update({ status }).eq('id', id)
    await loadReservations()
  }

  const handleToggleClosed = async (slot: string, currentlyClosed: boolean) => {
    setActionLoading(true)
    const supabase = createClient()
    if (currentlyClosed) {
      await supabase.from('trainer_schedules').delete()
        .eq('trainer_id', selectedTrainer).eq('scheduled_date', currentDate).eq('start_time', slot)
    } else {
      const endTime = new Date(`2000-01-01T${slot}`)
      endTime.setMinutes(endTime.getMinutes() + 30)
      await supabase.from('trainer_schedules').insert({
        trainer_id: selectedTrainer, scheduled_date: currentDate,
        start_time: slot, end_time: endTime.toTimeString().substring(0, 8), is_available: false
      })
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Rezervasyonlar</h1>
        <div className="flex gap-2">
          <button onClick={() => setTab('list')}
            className={`px-4 py-2 rounded-lg text-sm font-bold ${tab === 'list' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Liste
          </button>
          <button onClick={() => setTab('calendar')}
            className={`px-4 py-2 rounded-lg text-sm font-bold ${tab === 'calendar' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Takvim
          </button>
        </div>
      </div>

      {/* LİSTE */}
      {tab === 'list' && (
        <>
          <div className="flex flex-col gap-3 mb-6">
            <div className="flex gap-3">
              <input type="text" placeholder="Üye veya eğitmen ara..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="flex-1 px-4 py-2 border rounded-lg text-gray-900 text-sm" />
              <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
                className="px-4 py-2 border rounded-lg text-gray-900 text-sm" />
              {dateFilter && (
                <button onClick={() => setDateFilter('')}
                  className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-600 hover:bg-gray-200">Temizle</button>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {['Tümü','Beklemede','Onaylı','Tamamlandı','İptal','Gelmedi'].map(f => (
                <button key={f} onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1 rounded-full text-sm font-bold ${statusFilter === f ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          {loading ? <p className="text-gray-500">Yükleniyor...</p> : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-600">Tarih & Saat</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-600">Üye</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-600">Eğitmen</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-600">Durum</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-600">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-8 text-gray-400">Rezervasyon bulunamadı.</td></tr>
                  )}
                  {filtered.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="text-sm font-bold text-gray-900">{formatDate(r.scheduled_date)}</p>
                        <p className="text-xs text-gray-500">{formatTime(r.start_time)} — {formatTime(r.end_time)}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{r.member_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{r.trainer_name}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-bold ${STATUS_COLOR[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {STATUS_MAP[r.status] ?? r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select value={r.status} onChange={e => handleStatusChange(r.id, e.target.value)}
                          className="text-xs px-2 py-1 border rounded-lg text-gray-900">
                          <option value="pending">Beklemede</option>
                          <option value="approved">Onaylı</option>
                          <option value="completed">Tamamlandı</option>
                          <option value="cancelled">İptal</option>
                          <option value="no_show">Gelmedi</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* TAKVİM */}
      {tab === 'calendar' && (
        <div className="flex gap-4">
          <div className="flex-1">
            {/* Eğitmen seç + tarih nav */}
            <div className="flex items-center gap-4 mb-4">
              <select value={selectedTrainer} onChange={e => setSelectedTrainer(e.target.value)}
                className="px-4 py-2 border rounded-lg text-sm text-gray-900">
                {trainers.map(t => <option key={t.id} value={t.id}>{t.name} {t.surname}</option>)}
              </select>
              <div className="flex items-center gap-3 flex-1 justify-center">
                <button onClick={() => changeDate(-1)} className="bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg text-sm">←</button>
                <p className="text-sm font-bold text-gray-900">{formatDayLabel(currentDate)}</p>
                <button onClick={() => changeDate(1)} className="bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg text-sm">→</button>
              </div>
            </div>

            {calLoading ? <p className="text-gray-500">Yükleniyor...</p> : (
              <div className="space-y-1">
                {SLOTS.map(slot => {
                  const res = slotReservations[slot]
                  const isClosed = closedSlots.has(slot)
                  const isSelected = selectedSlot === slot

                  let bg = 'bg-white border-gray-200 hover:border-gray-400'
                  let content = <span className="text-xs text-green-600">Müsait</span>

                  if (res) {
                    bg = res.status === 'completed' ? 'bg-green-50 border-green-200' :
                         res.status === 'no_show' ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'
                    content = (
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-gray-900">{res.member_name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${STATUS_COLOR[res.status]}`}>
                          {STATUS_MAP[res.status]}
                        </span>
                      </div>
                    )
                  } else if (isClosed) {
                    bg = 'bg-gray-50 border-gray-200 opacity-50'
                    content = <span className="text-xs text-gray-400">Kapalı</span>
                  }

                  return (
                    <button key={slot} onClick={() => handleSlotClick(slot)}
                      className={`w-full flex items-center gap-4 px-4 py-2 rounded-lg border transition-colors ${bg} ${isSelected ? 'ring-2 ring-gray-900' : ''}`}>
                      <span className="text-sm font-bold text-gray-700 w-12">{formatTime(slot)}</span>
                      {content}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Aksiyon paneli */}
          {selectedSlot && (
            <div className="w-64 bg-white border border-gray-200 rounded-xl p-4 flex-shrink-0">
              <div className="flex justify-between items-center mb-3">
                <p className="font-bold text-gray-900">{formatTime(selectedSlot)}</p>
                <button onClick={() => setSelectedSlot(null)} className="text-gray-400 hover:text-gray-700 text-lg font-bold">✕</button>
              </div>

              {selectedRes ? (
                <div className="space-y-2">
                  <p className="text-sm font-bold text-gray-900">{selectedRes.member_name}</p>
                  <p className={`text-xs font-bold px-2 py-1 rounded-full inline-block ${STATUS_COLOR[selectedRes.status]}`}>
                    {STATUS_MAP[selectedRes.status]}
                  </p>
                  <select value={selectedRes.status}
                    onChange={async e => {
                      const supabase = createClient()
                      await supabase.from('reservations').update({ status: e.target.value }).eq('id', selectedRes.id)
                      await loadCalendar()
                    }}
                    className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900">
                    <option value="pending">Beklemede</option>
                    <option value="approved">Onaylı</option>
                    <option value="completed">Tamamlandı</option>
                    <option value="cancelled">İptal</option>
                    <option value="no_show">Gelmedi</option>
                  </select>
                  <button onClick={() => handleCancel(selectedRes.id)} disabled={actionLoading}
                    className="w-full bg-red-50 text-red-600 font-bold py-2 rounded-lg hover:bg-red-100 text-sm">
                    İptal Et
                  </button>
                </div>
              ) : isClosed ? (
                <button onClick={() => handleToggleClosed(selectedSlot, true)} disabled={actionLoading}
                  className="w-full bg-gray-100 text-gray-700 font-bold py-2 rounded-lg hover:bg-gray-200 text-sm">
                  Slotu Aç
                </button>
              ) : (
                <div className="space-y-2">
                  <button onClick={() => handleToggleClosed(selectedSlot, false)} disabled={actionLoading}
                    className="w-full bg-gray-100 text-gray-700 font-bold py-2 rounded-lg hover:bg-gray-200 text-sm mb-2">
                    Slotu Kapat
                  </button>
                  <p className="text-xs text-gray-500 font-bold">Ders Koy:</p>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {members.length === 0
                      ? <p className="text-xs text-gray-400">Atanmış üye yok.</p>
                      : members.map(m => (
                        <button key={m.id} onClick={() => handleBookMember(m)} disabled={actionLoading}
                          className="w-full rounded-lg p-2 text-left bg-gray-50 hover:bg-gray-100">
                          <p className="text-xs font-bold text-gray-900">{m.name} {m.surname}</p>
                          {m.remaining_lessons <= 0
                            ? <p className="text-xs text-red-400">Ders yok</p>
                            : <p className="text-xs text-green-600">{m.remaining_lessons} ders</p>
                          }
                        </button>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}