'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']
const DAYS_TR   = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi']
const MONTHS_S  = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']

function pad(n: number) { return String(n).padStart(2, '0') }

function todayKey() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }))
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}
function weekAgoKey() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }))
  d.setDate(d.getDate() - 7)
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}
function fmtDate(s: string) {
  const d = new Date(s + 'T00:00:00')
  return `${d.getDate()} ${MONTHS_S[d.getMonth()]} ${d.getFullYear()}`
}

const STATUS_LABEL: Record<string,string> = {
  pending: 'Beklemede', approved: 'Onaylı', completed: 'Tamamlandı',
  cancelled: 'İptal', no_show: 'Gelmedi',
}
const STATUS_COLOR: Record<string,string> = {
  pending: '#f59e0b', approved: '#38bdf8', completed: '#34d399',
  cancelled: '#f87171', no_show: '#fb923c',
}

type CardKey = 'total' | 'completed' | 'remaining' | 'new_members'

export default function AdminDashboard() {
  const today   = todayKey()
  const weekAgo = weekAgoKey()
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }))
  const dateLabel = `${DAYS_TR[now.getDay()]}, ${now.getDate()} ${MONTHS_TR[now.getMonth()]}`

  const [stats, setStats] = useState({ total: 0, completed: 0, remaining: 0, newMembers: 0, pendingFirst: 0, pendingNew: 0 })
  const [activeCard, setActiveCard]     = useState<CardKey | null>(null)
  const [modalData, setModalData]       = useState<any[]>([])
  const [modalLoading, setModalLoading] = useState(false)

  // Düzenleme
  const [editItem,    setEditItem]    = useState<any>(null)
  const [editDate,    setEditDate]    = useState('')
  const [editStatus,  setEditStatus]  = useState('')
  const [editSaving,  setEditSaving]  = useState(false)

  const INPUT_S = { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)', color: '#c8d6f0' }

  const handleEditRes = async () => {
    if (!editItem) return
    setEditSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (editStatus === 'cancelled') {
      await supabase.rpc('admin_cancel_reservation', { p_reservation_id: editItem.id })
    } else if (editStatus === 'completed' || editStatus === 'no_show') {
      await supabase.rpc('mark_attendance', { p_reservation_id: editItem.id, p_status: editStatus, p_marked_by: user?.id })
    } else {
      await supabase.from('reservations').update({ scheduled_date: editDate, status: editStatus }).eq('id', editItem.id)
    }
    setModalData(prev => prev.map(r => r.id === editItem.id ? { ...r, status: editStatus } : r))
    setEditItem(null)
    setEditSaving(false)
  }

  const handleDeleteRes = async (id: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.rpc('admin_cancel_reservation', { p_reservation_id: id })
    setModalData(prev => prev.filter(r => r.id !== id))
    setEditItem(null)
  }

  const handleDeleteMember = async (id: string) => {
    const supabase = createClient()
    await supabase.from('members').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    setModalData(prev => prev.filter((m: any) => m.id !== id))
    setEditItem(null)
  }

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('reservations').select('status').eq('scheduled_date', today).neq('status', 'cancelled'),
      supabase.from('membership_requests').select('id, member_id, members!inner(member_status)').eq('status', 'pending'),
      // "Yeni Kayıt" = BUGÜN üye olup BUGÜN paket talebi oluşturanlar — mevcut/eski üyenin
      // yeni paket talebi (yenileme/ek paket) bu sayıma girmemeli, o "Bekleyen Talepler"de görünür
      supabase.from('membership_requests').select('member_id').gte('created_at', today + 'T00:00:00'),
      supabase.from('members').select('id, created_at').gte('created_at', today + 'T00:00:00').is('deleted_at', null),
    ]).then(async ([{ data: res }, { data: reqs }, { data: newReqs }, { data: newMems }]) => {
      const newMemberMap = new Map((newMems ?? []).map((m: any) => [m.id, m.created_at]))
      const candidateIds = [...new Set(
        (newReqs ?? []).map((r: any) => r.member_id).filter((id: string) => newMemberMap.has(id))
      )]
      // Geçmişe dönük (kayıt tarihinden önceki) rezervasyonu olanlar "geçmiş ders ekle" ile
      // işlenmiş eski üyelerdir — gerçek yeni kayıt sayılmaz
      let backfilledIds = new Set<string>()
      if (candidateIds.length > 0) {
        const { data: oldRes } = await supabase.from('reservations')
          .select('member_id, scheduled_date')
          .in('member_id', candidateIds)
        backfilledIds = new Set(
          (oldRes ?? [])
            .filter((r: any) => r.scheduled_date < String(newMemberMap.get(r.member_id)).slice(0, 10))
            .map((r: any) => r.member_id)
        )
      }
      const uniqueNewMembers = new Set(candidateIds.filter(id => !backfilledIds.has(id)))
      // İlk paket: pending_club_approval üyelerden gelen talepler (yeni kayıt onayı bekliyor)
      // Yeni paket: active üyelerden gelen talepler (ek/yenileme paketi)
      const pendingFirst = (reqs ?? []).filter((r: any) => {
        const m = Array.isArray(r.members) ? r.members[0] : r.members
        return m?.member_status === 'pending_club_approval'
      }).length
      const pendingNew = (reqs ?? []).filter((r: any) => {
        const m = Array.isArray(r.members) ? r.members[0] : r.members
        return m?.member_status === 'active'
      }).length
      setStats({
        total:        res?.length ?? 0,
        completed:    res?.filter(r => r.status === 'completed').length ?? 0,
        remaining:    res?.filter(r => r.status === 'approved' || r.status === 'pending').length ?? 0,
        newMembers:   uniqueNewMembers.size,
        pendingFirst,
        pendingNew,
      })
    })
  }, [])

  const openCard = async (key: CardKey) => {
    setActiveCard(key)
    setModalLoading(true)
    setModalData([])
    const supabase = createClient()

    if (key === 'total' || key === 'completed' || key === 'remaining') {
      let q = supabase.from('reservations')
        .select('id, start_time, end_time, status, members(name, surname), trainers(name, surname)')
        .eq('scheduled_date', today)
        .neq('status', 'cancelled')
        .order('start_time')

      if (key === 'completed')  q = q.eq('status', 'completed')
      if (key === 'remaining')  q = q.in('status', ['approved', 'pending'])

      const { data } = await q
      setModalData((data ?? []).map((r: any) => {
        const m = Array.isArray(r.members) ? r.members[0] : r.members
        const t = Array.isArray(r.trainers) ? r.trainers[0] : r.trainers
        return {
          id: r.id,
          time: `${r.start_time?.substring(0,5)} – ${r.end_time?.substring(0,5)}`,
          member: m ? `${m.name} ${m.surname}` : 'Bilinmiyor',
          trainer: t ? `${t.name} ${t.surname}` : '—',
          status: r.status,
        }
      }))
    } else {
      // "Yeni Kayıt" listesi: BUGÜN üye olup BUGÜN paket talebi oluşturanlar
      // (mevcut/eski üyenin bugün açtığı yeni paket talebi burada sayılmaz)
      const { data: reqRows } = await supabase.from('membership_requests')
        .select('member_id, created_at')
        .gte('created_at', today + 'T00:00:00')
        .order('created_at', { ascending: false })
      const memberIds = [...new Set((reqRows ?? []).map((r: any) => r.member_id))]
      if (memberIds.length === 0) { setModalData([]); setModalLoading(false); return }
      const { data: mems } = await supabase.from('members')
        .select('id, name, surname, email, phone, created_at')
        .in('id', memberIds)
        .gte('created_at', today + 'T00:00:00')
        .is('deleted_at', null)
      const memberMap = new Map((mems ?? []).map((m: any) => [m.id, m]))
      // Geçmişe dönük (kayıt tarihinden önceki) rezervasyonu olanlar "geçmiş ders ekle" ile
      // işlenmiş eski üyelerdir — gerçek yeni kayıt sayılmaz (üst sayaçla aynı kural)
      const candIds = [...memberMap.keys()]
      let backfilledIds = new Set<string>()
      if (candIds.length > 0) {
        const { data: oldRes } = await supabase.from('reservations')
          .select('member_id, scheduled_date')
          .in('member_id', candIds)
        backfilledIds = new Set(
          (oldRes ?? [])
            .filter((r: any) => r.scheduled_date < String(memberMap.get(r.member_id)?.created_at).slice(0, 10))
            .map((r: any) => r.member_id)
        )
      }
      const seen = new Set<string>()
      const ordered: any[] = []
      for (const r of reqRows ?? []) {
        if (seen.has(r.member_id)) continue
        seen.add(r.member_id)
        if (backfilledIds.has(r.member_id)) continue
        const m = memberMap.get(r.member_id)
        if (m) ordered.push(m)
      }
      setModalData(ordered)
    }
    setModalLoading(false)
  }

  const cards: { key: CardKey; label: string; value: number; icon: string; color: string }[] = [
    { key: 'total',       label: 'Toplam Ders',     value: stats.total,      icon: '📅', color: '#38bdf8' },
    { key: 'completed',   label: 'Tamamlandı',      value: stats.completed,  icon: '✅', color: '#34d399' },
    { key: 'remaining',   label: 'Kalan',           value: stats.remaining,  icon: '⏳', color: '#f59e0b' },
    { key: 'new_members', label: 'Yeni Kayıt',     value: stats.newMembers, icon: '👤', color: '#a78bfa' },
  ]

  const MODAL_TITLE: Record<CardKey, string> = {
    total:       'Bugünkü Tüm Dersler',
    completed:   'Tamamlanan Dersler',
    remaining:   'Kalan Dersler',
    new_members: 'Bugün Yeni Kayıtlar',
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#7b93c4' }}>Bugün</p>
        <h1 className="text-2xl font-bold text-white">{dateLabel}</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        {cards.map(card => (
          <button
            key={card.key}
            onClick={() => openCard(card.key)}
            className="rounded-2xl p-4 text-left active:opacity-75 transition-opacity"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="text-2xl mb-2">{card.icon}</div>
            <div className="text-3xl font-bold text-white mb-1">{card.value}</div>
            <div className="text-xs" style={{ color: '#7b93c4' }}>{card.label}</div>
          </button>
        ))}
      </div>

      {stats.pendingFirst > 0 && (
        <Link href="/admin/membership-requests" className="block mb-3">
          <div className="rounded-2xl p-4 flex items-center justify-between active:opacity-80"
            style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)' }}>
            <div>
              <p className="font-bold text-white text-sm">{stats.pendingFirst} İlk Paket Başvurusu</p>
              <p className="text-xs mt-0.5" style={{ color: '#f59e0b' }}>Yeni üye onayı bekliyor →</p>
            </div>
            <span className="text-2xl">🆕</span>
          </div>
        </Link>
      )}

      {stats.pendingNew > 0 && (
        <Link href="/admin/membership-requests" className="block mb-3">
          <div className="rounded-2xl p-4 flex items-center justify-between active:opacity-80"
            style={{ background: 'rgba(56,189,248,0.10)', border: '1px solid rgba(56,189,248,0.3)' }}>
            <div>
              <p className="font-bold text-white text-sm">{stats.pendingNew} Yeni Paket Başvurusu</p>
              <p className="text-xs mt-0.5" style={{ color: '#38bdf8' }}>Paket onayı bekliyor →</p>
            </div>
            <span className="text-2xl">📦</span>
          </div>
        </Link>
      )}

      {/* Aile Grupları linki */}
      <Link href="/admin/families">
        <div className="rounded-2xl p-4 flex items-center justify-between active:opacity-80"
          style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)' }}>
          <div>
            <p className="font-bold text-white text-sm">Aile Grupları</p>
            <p className="text-xs mt-0.5" style={{ color: '#a78bfa' }}>Aile üyeliklerini yönet →</p>
          </div>
          <span className="text-2xl">👨‍👩‍👧‍👦</span>
        </div>
      </Link>

      {/* Modal */}
      {activeCard && (
        <div className="fixed inset-0 z-[70] flex items-end" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full rounded-t-3xl flex flex-col"
            style={{ background: '#0d1b4b', maxHeight: '75vh', border: '1px solid rgba(255,255,255,0.10)' }}>
            <div className="flex justify-between items-center px-5 py-4 flex-shrink-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <h3 className="text-base font-bold text-white">{MODAL_TITLE[activeCard]}</h3>
              <button onClick={() => setActiveCard(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-lg font-bold"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#7b93c4' }}>✕</button>
            </div>

            <div className="overflow-y-auto flex-1 px-4 py-4 space-y-2">
              {modalLoading && <p className="text-center py-8 text-sm" style={{ color: '#7b93c4' }}>Yükleniyor...</p>}

              {!modalLoading && modalData.length === 0 && (
                <p className="text-center py-8 text-sm" style={{ color: '#7b93c4' }}>Kayıt bulunamadı.</p>
              )}

              {/* Ders listesi */}
              {!modalLoading && activeCard !== 'new_members' && modalData.map((r, i) => (
                <button key={i} onClick={() => { setEditItem(r); setEditDate(today); setEditStatus(r.status) }}
                  className="w-full rounded-2xl p-3 flex justify-between items-center text-left active:opacity-70"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div>
                    <p className="text-sm font-bold text-white">{r.member}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#7b93c4' }}>{r.time} · {r.trainer}</p>
                  </div>
                  <span className="text-xs font-bold flex-shrink-0" style={{ color: STATUS_COLOR[r.status] ?? '#c8d6f0' }}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </button>
              ))}

              {/* Yeni üye listesi */}
              {!modalLoading && activeCard === 'new_members' && modalData.map((m: any, i: number) => (
                <button key={i} onClick={() => setEditItem({ ...m, _type: 'member' })}
                  className="w-full rounded-2xl p-3 text-left active:opacity-70"
                  style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)' }}>
                  <p className="text-sm font-bold text-white">{m.name} {m.surname}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#7b93c4' }}>{m.email}</p>
                  <p className="text-xs" style={{ color: '#4a6190' }}>{fmtDate(m.created_at?.substring(0,10))}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Düzenleme / Silme modalı */}
      {editItem && (
        <div className="fixed inset-0 z-[80] flex items-end" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div className="w-full rounded-t-3xl p-6" style={{ background: '#0d1b4b', border: '1px solid rgba(255,255,255,0.10)' }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'rgba(255,255,255,0.15)' }} />

            {editItem._type === 'member' ? (
              <>
                <h3 className="text-base font-bold text-white mb-1">{editItem.name} {editItem.surname}</h3>
                <p className="text-xs mb-5" style={{ color: '#7b93c4' }}>{editItem.email}</p>
                <div className="flex gap-3">
                  <button onClick={() => setEditItem(null)} className="flex-1 py-3 rounded-2xl font-bold text-sm"
                    style={{ background: 'rgba(255,255,255,0.08)', color: '#7b93c4' }}>Kapat</button>
                  <a href={`/admin/members/${editItem.id}/settings`} className="flex-1 py-3 rounded-2xl font-bold text-sm text-center"
                    style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                    Ayarlar →
                  </a>
                  <button onClick={() => handleDeleteMember(editItem.id)}
                    className="flex-1 py-3 rounded-2xl font-bold text-sm"
                    style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}>
                    Sil
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-base font-bold text-white mb-1">{editItem.member}</h3>
                <p className="text-xs mb-4" style={{ color: '#7b93c4' }}>{editItem.time} · {editItem.trainer}</p>
                <div className="space-y-3 mb-4">
                  <div>
                    <p className="text-xs mb-1 font-bold" style={{ color: '#7b93c4' }}>Tarih</p>
                    <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={INPUT_S} />
                  </div>
                  <div>
                    <p className="text-xs mb-2 font-bold" style={{ color: '#7b93c4' }}>Durum</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[{v:'completed',l:'Tamamlandı',c:'#34d399'},{v:'no_show',l:'Gelmedi',c:'#f59e0b'},{v:'cancelled',l:'İptal',c:'#f87171'}].map(s => (
                        <button key={s.v} onClick={() => setEditStatus(s.v)} className="py-2.5 rounded-xl text-xs font-bold"
                          style={editStatus===s.v ? {background:`${s.c}22`,color:s.c,border:`1px solid ${s.c}55`} : {background:'rgba(255,255,255,0.05)',color:'#7b93c4'}}>
                          {s.l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditItem(null)} className="flex-1 py-3 rounded-2xl font-bold text-sm"
                    style={{ background: 'rgba(255,255,255,0.08)', color: '#7b93c4' }}>Vazgeç</button>
                  <button onClick={() => handleDeleteRes(editItem.id)} className="py-3 px-4 rounded-2xl font-bold text-sm"
                    style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}>
                    Sil
                  </button>
                  <button onClick={handleEditRes} disabled={editSaving} className="flex-1 py-3 rounded-2xl font-bold text-sm disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#0a0f2e' }}>
                    {editSaving ? '...' : 'Kaydet'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
