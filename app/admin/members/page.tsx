'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const MONTHS_TR = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
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

type MemberDetail = { memberships: any[]; reservations: any[]; trainers: any[] }

const STATUS_FILTERS = ['Tümü', 'Aktif', 'Pasif', 'Paketi Biten', 'Paketi Bitecek']
const SHIFT_OPTIONS  = [
  { value: 'morning',  label: 'Sabah' },
  { value: 'evening',  label: 'Akşam' },
  { value: 'fullday',  label: 'Tam Gün' },
]

const CARD = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }
const CARD_ACTIVE = { background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)' }

export default function MembersPage() {
  const [members, setMembers]         = useState<Member[]>([])
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [filter, setFilter]               = useState('Tümü')
  const [selected, setSelected]           = useState<Member | null>(null)
  const [detail, setDetail]               = useState<MemberDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  // Eğitmen atama modal
  const [promoteModal, setPromoteModal]   = useState(false)
  const [bonusRate, setBonusRate]         = useState('0')
  const [shift, setShift]                 = useState('fullday')
  const [promoting, setPromoting]         = useState(false)
  const [promoteMsg, setPromoteMsg]       = useState('')

  useEffect(() => { loadMembers() }, [])

  const loadMembers = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: membersData } = await supabase
      .from('members').select('id, name, surname, email, phone, member_status, created_at, default_trainer_id')
      .is('deleted_at', null).order('created_at', { ascending: false })
    if (!membersData) { setLoading(false); return }

    const memberIds = membersData.map(m => m.id)
    const [{ data: memberships }, { data: trainers }] = await Promise.all([
      supabase.from('memberships').select('member_id, total_lessons, used_lessons, reserved_lessons').in('member_id', memberIds).eq('is_current', true),
      supabase.from('trainers').select('id, name, surname'),
    ])
    const remainingMap = new Map<string, number>()
    const totalMap = new Map<string, number>()
    for (const m of memberships ?? []) {
      remainingMap.set(m.member_id, (remainingMap.get(m.member_id) ?? 0) + (m.total_lessons - m.used_lessons - m.reserved_lessons))
      totalMap.set(m.member_id, (totalMap.get(m.member_id) ?? 0) + m.total_lessons)
    }
    const trainerMap = new Map((trainers ?? []).map(t => [t.id, `${t.name} ${t.surname}`]))
    setMembers(membersData.map(m => ({ ...m, remaining_lessons: remainingMap.get(m.id) ?? 0, total_lessons: totalMap.get(m.id) ?? 0, trainer_name: m.default_trainer_id ? (trainerMap.get(m.default_trainer_id) ?? null) : null })))
    setLoading(false)
  }

  const loadDetail = async (member: Member) => {
    setSelected(member)
    setDetailLoading(true)
    const supabase = createClient()
    const [{ data: memberships }, { data: reservations }, { data: trainers }] = await Promise.all([
      supabase.from('memberships').select('*').eq('member_id', member.id).order('created_at', { ascending: false }),
      supabase.from('reservations').select('id, scheduled_date, start_time, status, trainers(name, surname)').eq('member_id', member.id).order('scheduled_date', { ascending: false }).limit(20),
      supabase.from('trainers').select('id, name, surname').is('deleted_at', null),
    ])
    setDetail({ memberships: memberships ?? [], reservations: reservations ?? [], trainers: trainers ?? [] })
    setDetailLoading(false)
  }

  const handlePromote = async () => {
    if (!selected) return
    setPromoting(true)
    setPromoteMsg('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.rpc('promote_member_to_trainer', {
      p_member_id:  selected.id,
      p_admin_id:   user.id,
      p_bonus_rate: parseFloat(bonusRate) || 0,
      p_shift:      shift,
    })

    setPromoting(false)
    if (error) {
      setPromoteMsg('Hata: ' + error.message)
    } else {
      setPromoteModal(false)
      setSelected(null)
      setDetail(null)
      await loadMembers()
    }
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
      filter === 'Aktif' ? m.member_status === 'active' && m.remaining_lessons > 0 :
      filter === 'Pasif' ? m.member_status !== 'active' :
      filter === 'Paketi Biten' ? m.total_lessons > 0 && m.remaining_lessons <= 0 :
      filter === 'Paketi Bitecek' ? m.remaining_lessons > 0 && m.remaining_lessons <= 3 : true
    return matchSearch && matchFilter
  })

  const statusLabel = (s: string) => ({ active: 'Aktif', inactive: 'Pasif', pending_club_approval: 'Beklemede' }[s] ?? s)
  const statusColor = (s: string) => ({ active: '#34d399', inactive: '#7b93c4', pending_club_approval: '#f59e0b' }[s] ?? '#7b93c4')
  const resStatusColor = (s: string) => ({ completed: '#34d399', cancelled: '#f87171', no_show: '#f59e0b', pending: '#7b93c4', approved: '#38bdf8' }[s] ?? '#7b93c4')
  const resStatusLabel = (s: string) => ({ completed: 'Tamamlandı', cancelled: 'İptal', no_show: 'Gelmedi', pending: 'Beklemede', approved: 'Onaylı' }[s] ?? s)

  return (
    <div>
      {/* LİSTE */}
      <div className="mb-6 flex flex-col gap-3">
        <h1 className="text-2xl font-bold text-white">Üyeler</h1>
        <input
          type="text"
          placeholder="İsim veya email ara..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-3 rounded-xl text-sm outline-none"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: '#c8d6f0' }}
        />
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1 rounded-full text-xs font-bold transition-colors"
              style={filter === f
                ? { background: '#f59e0b', color: '#0a0f2e' }
                : { background: 'rgba(255,255,255,0.06)', color: '#7b93c4', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-center py-8" style={{ color: '#7b93c4' }}>Yükleniyor...</p>
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 && <p style={{ color: '#7b93c4' }}>Üye bulunamadı.</p>}
          {filtered.map(member => (
            <button
              key={member.id}
              onClick={() => loadDetail(member)}
              className="w-full text-left p-4 rounded-2xl transition-all active:opacity-80"
              style={selected?.id === member.id ? CARD_ACTIVE : CARD}
            >
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-white truncate">{member.name} {member.surname}</p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: '#7b93c4' }}>{member.email}</p>
                  {member.trainer_name && <p className="text-xs mt-0.5" style={{ color: '#4a6190' }}>Eğitmen: {member.trainer_name}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-bold" style={{ color: statusColor(member.member_status) }}>{statusLabel(member.member_status)}</p>
                  <p className="text-sm font-bold text-white mt-0.5">{member.remaining_lessons} ders</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* DETAY PANELİ — mobilde tam ekran overlay */}
      {selected && (
        <div
          className="fixed inset-0 z-40 overflow-y-auto"
          style={{ background: 'linear-gradient(160deg, #0a0f2e, #0d1b4b, #071428)' }}
        >
          {/* Geri header */}
          <div
            className="flex items-center gap-3 px-4 pt-14 pb-4 sticky top-0"
            style={{ background: '#0a0f2e', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
          >
            <button
              onClick={() => { setSelected(null); setDetail(null) }}
              className="font-bold text-sm px-3 py-2 rounded-xl"
              style={{ color: '#7b93c4', background: 'rgba(255,255,255,0.06)' }}
            >
              ← Geri
            </button>
            <h2 className="font-bold text-white truncate">{selected.name} {selected.surname}</h2>
          </div>

          <div className="px-4 py-6 space-y-4">
            {/* Bilgiler */}
            <div className="rounded-2xl p-4 space-y-1" style={CARD}>
              <p className="text-sm text-white font-bold">{selected.name} {selected.surname}</p>
              <p className="text-xs" style={{ color: '#7b93c4' }}>{selected.email}</p>
              <p className="text-xs" style={{ color: '#7b93c4' }}>{selected.phone}</p>
            </div>

            {/* Durum */}
            <div className="rounded-2xl p-4" style={CARD}>
              <p className="text-xs font-bold mb-2" style={{ color: '#7b93c4' }}>Üye Durumu</p>
              <select
                value={selected.member_status}
                onChange={e => updateStatus(selected.id, e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#c8d6f0' }}
              >
                <option value="active">Aktif</option>
                <option value="inactive">Pasif</option>
              </select>
            </div>

            {/* Eğitmen */}
            {detail && (
              <div className="rounded-2xl p-4" style={CARD}>
                <p className="text-xs font-bold mb-2" style={{ color: '#7b93c4' }}>Eğitmen</p>
                <select
                  value={selected.default_trainer_id ?? ''}
                  onChange={e => updateTrainer(selected.id, e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#c8d6f0' }}
                >
                  <option value="">Atanmamış</option>
                  {detail.trainers.map(t => <option key={t.id} value={t.id}>{t.name} {t.surname}</option>)}
                </select>
              </div>
            )}

            {detailLoading ? (
              <p className="text-center py-4" style={{ color: '#7b93c4' }}>Yükleniyor...</p>
            ) : detail && (
              <>
                {/* Paketler */}
                <div>
                  <p className="text-sm font-bold text-white mb-2">Paketler</p>
                  {detail.memberships.length === 0
                    ? <p className="text-xs" style={{ color: '#7b93c4' }}>Paket yok.</p>
                    : detail.memberships.map(m => (
                      <div
                        key={m.id}
                        className="rounded-2xl p-4 mb-2"
                        style={m.is_current ? { background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)' } : CARD}
                      >
                        <div className="flex justify-between mb-1">
                          <span className="font-bold text-white">{m.total_lessons} Ders</span>
                          <span className="text-xs font-bold" style={{ color: m.is_current ? '#f59e0b' : '#4a6190' }}>{m.is_current ? 'Aktif' : 'Geçmiş'}</span>
                        </div>
                        <p className="text-xs" style={{ color: '#7b93c4' }}>{formatDate(m.start_date)} — {formatDate(m.end_date)}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#7b93c4' }}>Kalan: {m.total_lessons - m.used_lessons - m.reserved_lessons} · Kullanılan: {m.used_lessons}</p>
                      </div>
                    ))
                  }
                </div>

                {/* Rezervasyonlar */}
                <div>
                  <p className="text-sm font-bold text-white mb-2">Son Rezervasyonlar</p>
                  {detail.reservations.length === 0
                    ? <p className="text-xs" style={{ color: '#7b93c4' }}>Rezervasyon yok.</p>
                    : detail.reservations.map(r => {
                      const trainer = Array.isArray(r.trainers) ? r.trainers[0] : r.trainers
                      return (
                        <div key={r.id} className="flex justify-between items-center py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          <div>
                            <p className="text-sm font-bold text-white">{formatDate(r.scheduled_date)}</p>
                            <p className="text-xs" style={{ color: '#7b93c4' }}>{r.start_time?.substring(0, 5)}{trainer ? ` · ${trainer.name} ${trainer.surname}` : ''}</p>
                          </div>
                          <span className="text-xs font-bold" style={{ color: resStatusColor(r.status) }}>{resStatusLabel(r.status)}</span>
                        </div>
                      )
                    })
                  }
                </div>
              </>
            )}
          {/* Eğitmen Yap butonu */}
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              onClick={() => { setPromoteModal(true); setBonusRate('0'); setShift('fullday'); setPromoteMsg('') }}
              className="w-full py-2.5 rounded-xl text-sm font-bold"
              style={{ background: 'rgba(56,189,248,0.12)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.25)' }}
            >
              🏇 Eğitmen Olarak Ata
            </button>
          </div>
        </div>
        </div>
      )}

      {/* Eğitmen atama onay modalı */}
      {promoteModal && selected && (
        <div className="fixed inset-0 z-[80] flex items-end" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div className="w-full rounded-t-3xl p-6" style={{ background: '#0d1b4b', border: '1px solid rgba(255,255,255,0.10)' }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'rgba(255,255,255,0.15)' }} />
            <h3 className="text-lg font-bold text-white mb-1">Eğitmen Olarak Ata</h3>
            <p className="text-sm mb-5" style={{ color: '#7b93c4' }}>
              {selected.name} {selected.surname} üyelikten çıkarılır ve eğitmen paneline taşınır.
            </p>

            <div className="space-y-4 mb-5">
              <div>
                <p className="text-xs font-bold mb-2" style={{ color: '#7b93c4' }}>Prim Oranı (%)</p>
                <input
                  type="number" min="0" max="100" value={bonusRate}
                  onChange={e => setBonusRate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: '#c8d6f0' }}
                />
              </div>
              <div>
                <p className="text-xs font-bold mb-2" style={{ color: '#7b93c4' }}>Vardiya</p>
                <div className="grid grid-cols-3 gap-2">
                  {SHIFT_OPTIONS.map(s => (
                    <button key={s.value} type="button" onClick={() => setShift(s.value)}
                      className="py-2.5 rounded-xl text-sm font-bold"
                      style={shift === s.value
                        ? { background: '#f59e0b', color: '#0a0f2e' }
                        : { background: 'rgba(255,255,255,0.06)', color: '#7b93c4', border: '1px solid rgba(255,255,255,0.08)' }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {promoteMsg && (
              <p className="text-xs mb-4 px-3 py-2 rounded-xl" style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171' }}>
                {promoteMsg}
              </p>
            )}

            <div className="flex gap-3">
              <button onClick={() => setPromoteModal(false)} disabled={promoting}
                className="flex-1 py-3 rounded-2xl font-bold text-sm disabled:opacity-50"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#7b93c4' }}>
                Vazgeç
              </button>
              <button onClick={handlePromote} disabled={promoting}
                className="flex-1 py-3 rounded-2xl font-bold text-sm disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #38bdf8, #0284c7)', color: '#fff' }}>
                {promoting ? 'Atanıyor...' : 'Onayla'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
