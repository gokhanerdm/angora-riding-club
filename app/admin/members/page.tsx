'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const MONTHS_TR = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]} ${d.getFullYear()}`
}

type Member = {
  id: string
  name: string
  surname: string
  email: string
  phone: string
  member_status: string
  created_at: string
  default_trainer_id: string | null
  remaining_lessons: number
  total_lessons: number
  trainer_name: string | null
}

type MemberDetail = {
  memberships: any[]
  reservations: any[]
  trainers: any[]
}

const STATUS_FILTERS = ['Tümü', 'Aktif', 'Pasif', 'Paketi Biten', 'Paketi Bitecek']

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('Tümü')
  const [selected, setSelected] = useState<Member | null>(null)
  const [detail, setDetail] = useState<MemberDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => { loadMembers() }, [])

  const loadMembers = async () => {
    setLoading(true)
    const supabase = createClient()

    const { data: membersData } = await supabase
      .from('members')
      .select('id, name, surname, email, phone, member_status, created_at, default_trainer_id')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (!membersData) { setLoading(false); return }

    const memberIds = membersData.map(m => m.id)

    const [{ data: memberships }, { data: trainers }] = await Promise.all([
      supabase.from('memberships').select('member_id, total_lessons, used_lessons, reserved_lessons, is_current').in('member_id', memberIds).eq('is_current', true),
      supabase.from('trainers').select('id, name, surname')
    ])

    const remainingMap = new Map<string, number>()
    const totalMap = new Map<string, number>()
    for (const m of memberships ?? []) {
      remainingMap.set(m.member_id, (remainingMap.get(m.member_id) ?? 0) + (m.total_lessons - m.used_lessons - m.reserved_lessons))
      totalMap.set(m.member_id, (totalMap.get(m.member_id) ?? 0) + m.total_lessons)
    }

    const trainerMap = new Map((trainers ?? []).map(t => [t.id, `${t.name} ${t.surname}`]))

    setMembers(membersData.map(m => ({
      ...m,
      remaining_lessons: remainingMap.get(m.id) ?? 0,
      total_lessons: totalMap.get(m.id) ?? 0,
      trainer_name: m.default_trainer_id ? (trainerMap.get(m.default_trainer_id) ?? null) : null
    })))
    setLoading(false)
  }

  const loadDetail = async (member: Member) => {
    setSelected(member)
    setDetailLoading(true)
    const supabase = createClient()

    const [{ data: memberships }, { data: reservations }, { data: trainers }] = await Promise.all([
      supabase.from('memberships').select('*').eq('member_id', member.id).order('created_at', { ascending: false }),
      supabase.from('reservations').select('id, scheduled_date, start_time, status, trainers(name, surname)').eq('member_id', member.id).order('scheduled_date', { ascending: false }).limit(20),
      supabase.from('trainers').select('id, name, surname').is('deleted_at', null)
    ])

    setDetail({ memberships: memberships ?? [], reservations: reservations ?? [], trainers: trainers ?? [] })
    setDetailLoading(false)
  }

  const updateTrainer = async (memberId: string, trainerId: string) => {
    const supabase = createClient()
    await supabase.from('members').update({ default_trainer_id: trainerId || null }).eq('id', memberId)
    await loadMembers()
  }

  const updateStatus = async (memberId: string, status: string) => {
    const supabase = createClient()
    await supabase.from('members').update({ member_status: status }).eq('id', memberId)
    await loadMembers()
  }

  const filtered = members.filter(m => {
    const matchSearch = `${m.name} ${m.surname} ${m.email}`.toLowerCase().includes(search.toLowerCase())
    const matchFilter =
      filter === 'Tümü' ? true :
      filter === 'Aktif' ? m.member_status === 'active' && m.remaining_lessons > 0 :
      filter === 'Pasif' ? m.member_status !== 'active' :
      filter === 'Paketi Biten' ? m.total_lessons > 0 && m.remaining_lessons <= 0 :
      filter === 'Paketi Bitecek' ? m.remaining_lessons > 0 && m.remaining_lessons <= 3 :
      true
    return matchSearch && matchFilter
  })

  const statusLabel = (s: string) => ({ active: 'Aktif', inactive: 'Pasif', pending_club_approval: 'Beklemede' }[s] ?? s)
  const statusColor = (s: string) => ({ active: 'bg-green-100 text-green-700', inactive: 'bg-gray-100 text-gray-600', pending_club_approval: 'bg-yellow-100 text-yellow-700' }[s] ?? 'bg-gray-100 text-gray-600')
  const resStatusColor = (s: string) => ({ completed: 'text-green-600', cancelled: 'text-red-500', no_show: 'text-orange-500', pending: 'text-gray-500', approved: 'text-blue-500' }[s] ?? 'text-gray-500')
  const resStatusLabel = (s: string) => ({ completed: 'Tamamlandı', cancelled: 'İptal', no_show: 'Gelmedi', pending: 'Beklemede', approved: 'Onaylı' }[s] ?? s)

  return (
    <div className="flex gap-6 h-full">
      <div className="flex-1 min-w-0">
        <div className="mb-6 flex flex-col gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Üyeler</h1>
          <input
            type="text"
            placeholder="İsim veya email ara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg text-gray-900 text-sm"
          />
          <div className="flex gap-2 flex-wrap">
            {STATUS_FILTERS.map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full text-sm font-bold transition-colors ${filter === f ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading ? <p className="text-gray-500">Yükleniyor...</p> : (
          <div className="space-y-2">
            {filtered.length === 0 && <p className="text-gray-500">Üye bulunamadı.</p>}
            {filtered.map(member => (
              <button key={member.id} onClick={() => loadDetail(member)}
                className={`w-full text-left p-4 rounded-xl border transition-colors ${selected?.id === member.id ? 'border-gray-900 bg-gray-50' : 'border-gray-200 bg-white hover:border-gray-400'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-gray-900">{member.name} {member.surname}</p>
                    <p className="text-sm text-gray-500">{member.email}</p>
                    {member.trainer_name && <p className="text-xs text-gray-400">Eğitmen: {member.trainer_name}</p>}
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <span className={`text-xs px-2 py-1 rounded-full font-bold ${statusColor(member.member_status)}`}>{statusLabel(member.member_status)}</span>
                    <span className="text-sm font-bold text-gray-700">{member.remaining_lessons} ders kalan</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="w-96 flex-shrink-0 bg-white border border-gray-200 rounded-2xl p-5 overflow-y-auto max-h-[calc(100vh-8rem)]">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{selected.name} {selected.surname}</h2>
              <p className="text-sm text-gray-500">{selected.email}</p>
              <p className="text-sm text-gray-500">{selected.phone}</p>
            </div>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700 text-xl font-bold">✕</button>
          </div>

          <div className="mb-4">
            <select value={selected.member_status} onChange={e => updateStatus(selected.id, e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900">
              <option value="active">Aktif</option>
              <option value="inactive">Pasif</option>
            </select>
          </div>

          {detail && (
            <div className="mb-4">
              <label className="text-xs text-gray-500 font-bold mb-1 block">Eğitmen</label>
              <select value={selected.default_trainer_id ?? ''} onChange={e => updateTrainer(selected.id, e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900">
                <option value="">Atanmamış</option>
                {detail.trainers.map(t => <option key={t.id} value={t.id}>{t.name} {t.surname}</option>)}
              </select>
            </div>
          )}

          {detailLoading ? <p className="text-gray-400 text-center py-4">Yükleniyor...</p> : detail && (
            <>
              <div className="mb-4">
                <h3 className="text-sm font-bold text-gray-700 mb-2">Paketler</h3>
                {detail.memberships.length === 0 ? <p className="text-xs text-gray-400">Paket yok.</p> :
                  detail.memberships.map(m => (
                    <div key={m.id} className={`p-3 rounded-lg mb-2 ${m.is_current ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'}`}>
                      <div className="flex justify-between">
                        <span className="text-sm font-bold text-gray-900">{m.total_lessons} Ders</span>
                        <span className={`text-xs font-bold ${m.is_current ? 'text-amber-600' : 'text-gray-400'}`}>{m.is_current ? 'Aktif' : 'Geçmiş'}</span>
                      </div>
                      <p className="text-xs text-gray-500">{formatDate(m.start_date)} — {formatDate(m.end_date)}</p>
                      <p className="text-xs text-gray-500">Kalan: {m.total_lessons - m.used_lessons - m.reserved_lessons} / Kullanılan: {m.used_lessons}</p>
                    </div>
                  ))
                }
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-2">Son Rezervasyonlar</h3>
                {detail.reservations.length === 0 ? <p className="text-xs text-gray-400">Rezervasyon yok.</p> :
                  detail.reservations.map(r => {
                    const trainer = Array.isArray(r.trainers) ? r.trainers[0] : r.trainers
                    return (
                      <div key={r.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                        <div>
                          <p className="text-sm font-bold text-gray-900">{formatDate(r.scheduled_date)}</p>
                          <p className="text-xs text-gray-500">{r.start_time?.substring(0,5)} · {trainer ? `${trainer.name} ${trainer.surname}` : ''}</p>
                        </div>
                        <span className={`text-xs font-bold ${resStatusColor(r.status)}`}>{resStatusLabel(r.status)}</span>
                      </div>
                    )
                  })
                }
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}