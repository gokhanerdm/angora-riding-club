'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']
const DAYS_TR   = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi']
const MONTHS_S  = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']

function pad(n: number) { return String(n).padStart(2, '0') }

function nowIstanbul() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }))
}
function todayKey() {
  const d = nowIstanbul()
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}
function weekStartKey() {
  const d = nowIstanbul()
  const day = d.getDay() === 0 ? 6 : d.getDay() - 1 // Pazartesi = 0
  d.setDate(d.getDate() - day)
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}
function monthStartKey() {
  const d = nowIstanbul()
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-01`
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

type LessonCardKey = 'total' | 'completed' | 'pending' | 'remaining'

export default function AdminDashboard() {
  const today      = todayKey()
  const weekStart  = weekStartKey()
  const monthStart = monthStartKey()
  const now        = nowIstanbul()
  const dateLabel  = `${DAYS_TR[now.getDay()]}, ${now.getDate()} ${MONTHS_TR[now.getMonth()]}`

  // ---- State ----
  const [lessonStats, setLessonStats] = useState({ total: 0, completed: 0, pending: 0, remaining: 0 })
  const [memberStats, setMemberStats] = useState({ today: 0, week: 0, month: 0, year: 0 })
  const [packageStats, setPackageStats] = useState({ today: 0 as number, week: 0 as number, month: 0 as number, total: 0 as number })
  const [visitStats, setVisitStats] = useState({ today: 0, week: 0, month: 0, total: 0 })
  const [pendingFirst, setPendingFirst] = useState(0)
  const [pendingNew, setPendingNew]     = useState(0)

  // Ham veriler (modal için)
  const [rawRealMembers, setRawRealMembers] = useState<any[]>([])
  const [rawPackages,    setRawPackages]    = useState<any[]>([])
  const [rawVisits,      setRawVisits]      = useState<{ today: any[]; week: any[]; month: any[]; total: any[] }>({ today: [], week: [], month: [], total: [] })

  // Ders modalı
  const [activeCard, setActiveCard]     = useState<LessonCardKey | null>(null)
  const [modalData, setModalData]       = useState<any[]>([])
  const [modalLoading, setModalLoading] = useState(false)
  const [editItem,    setEditItem]    = useState<any>(null)
  const [editDate,    setEditDate]    = useState('')
  const [editStatus,  setEditStatus]  = useState('')
  const [editSaving,  setEditSaving]  = useState(false)

  // Genel modal (kayıt / paket / gelen üye)
  type GenericModal = { type: 'member' | 'package' | 'visit'; period: 'today' | 'week' | 'month' | 'total' | 'year'; title: string }
  const [genericModal, setGenericModal] = useState<GenericModal | null>(null)
  const [genericData,  setGenericData]  = useState<any[]>([])
  const [genericLoading, setGenericLoading] = useState(false)

  const openGenericModal = async (type: GenericModal['type'], period: GenericModal['period'], title: string) => {
    setGenericModal({ type, period, title })
    setGenericLoading(true)
    setGenericData([])
    const supabase = createClient()

    if (type === 'member' && period === 'year') {
      // Tüm yıllara göre grupla — her yıl başlık, altında o yıl kayıt olanlar
      const groups = new Map<string, any[]>()
      for (const m of rawRealMembers) {
        const y = m.created_at.slice(0, 4)
        if (!groups.has(y)) groups.set(y, [])
        groups.get(y)!.push(m)
      }
      const sortedYears = [...groups.keys()].sort((a, b) => b.localeCompare(a))
      setGenericData(sortedYears.map(y => ({
        year: y,
        members: groups.get(y)!.sort((a, b) => b.created_at.localeCompare(a.created_at)),
      })))
    } else if (type === 'member') {
      const cutoff = period === 'today' ? today + 'T00:00:00' : period === 'week' ? weekStart + 'T00:00:00' : period === 'month' ? monthStart + 'T00:00:00' : '2000-01-01T00:00:00'
      const filtered = rawRealMembers.filter(m => m.created_at >= cutoff)
      setGenericData(filtered.sort((a, b) => b.created_at.localeCompare(a.created_at)))
    }

    if (type === 'package') {
      // Satış tarihi olarak start_date kullanılır (created_at değil — geçmiş paket geriye dönük girilebilir)
      const cutoff = period === 'today' ? today : period === 'week' ? weekStart : period === 'month' ? monthStart : '2000-01-01'
      const filtered = rawPackages.filter(p => p.start_date >= cutoff)
      // Üye adlarını çek
      const memberIds = [...new Set(filtered.map((p: any) => p.member_id))]
      const { data: mems } = await supabase.from('members').select('id, name, surname').in('id', memberIds)
      const memMap = new Map((mems ?? []).map((m: any) => [m.id, `${m.name} ${m.surname}`]))
      setGenericData(filtered.map(p => ({ ...p, member_name: memMap.get(p.member_id) ?? '—' })).sort((a, b) => b.start_date.localeCompare(a.start_date)))
    }

    if (type === 'visit') {
      const members = rawVisits[period]
      setGenericData(members)
    }

    setGenericLoading(false)
  }

  const INPUT_S = { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)', color: '#c8d6f0' }

  // ---- Auto complete ----
  useEffect(() => {
    const supabase = createClient()
    void supabase.rpc('auto_complete_past_lessons')
  }, [])

  // ---- Veri yükle ----
  useEffect(() => {
    const supabase = createClient()

    // Ders istatistikleri (bugün) — cancelled ve no_show hariç
    supabase.from('reservations').select('status').eq('scheduled_date', today).in('status', ['pending','approved','completed'])
      .then(({ data }) => {
        setLessonStats({
          total:     data?.length ?? 0,
          completed: data?.filter(r => r.status === 'completed').length ?? 0,
          pending:   data?.filter(r => r.status === 'pending').length ?? 0,
          remaining: data?.filter(r => r.status === 'approved' || r.status === 'pending').length ?? 0,
        })
      })

    // Bekleyen başvurular
    supabase.from('membership_requests').select('id, member_id, members!inner(member_status)').eq('status', 'pending')
      .then(({ data: reqs }) => {
        setPendingFirst((reqs ?? []).filter((r: any) => {
          const m = Array.isArray(r.members) ? r.members[0] : r.members
          return m?.member_status === 'pending_club_approval'
        }).length)
        setPendingNew((reqs ?? []).filter((r: any) => {
          const m = Array.isArray(r.members) ? r.members[0] : r.members
          return m?.member_status === 'active'
        }).length)
      })

    // Yeni kayıt — eski üyeler hariç (kayıt tarihinden önce dersi olan = geçmiş ders eklenmiş)
    supabase.from('members').select('id, name, surname, email, created_at').is('deleted_at', null).then(async ({ data: allMems }) => {
      const mems = allMems ?? []
      const { data: earlyRes } = await supabase.from('reservations').select('member_id, scheduled_date')
        .in('member_id', mems.map(m => m.id))
      const legacyIds = new Set(
        (earlyRes ?? []).filter((r: any) => {
          const mem = mems.find(m => m.id === r.member_id)
          return mem && r.scheduled_date < mem.created_at.slice(0, 10)
        }).map((r: any) => r.member_id)
      )
      const realMembers = mems.filter(m => !legacyIds.has(m.id))
      setRawRealMembers(realMembers)
      const yearStart = `${now.getFullYear()}-01-01`
      setMemberStats({
        today: realMembers.filter(m => m.created_at >= today + 'T00:00:00').length,
        week:  realMembers.filter(m => m.created_at >= weekStart + 'T00:00:00').length,
        month: realMembers.filter(m => m.created_at >= monthStart + 'T00:00:00').length,
        year:  realMembers.filter(m => m.created_at >= yearStart + 'T00:00:00').length,
      })
    })

    // Satılan paket — legacy paketler (payment_amount = 0) hariç, TL cinsinden
    // Sınıflandırma start_date'e göre yapılır (created_at değil — geçmiş paket geriye dönük girilebilir)
    supabase.from('memberships').select('id, member_id, payment_amount, total_lessons, start_date, created_at').gt('payment_amount', 0).then(({ data: pkgs }) => {
      const sum = (items: any[]) => items.reduce((acc, p) => acc + parseFloat(p.payment_amount ?? 0), 0)
      const all = pkgs ?? []
      setRawPackages(all)
      setPackageStats({
        today: sum(all.filter(p => p.start_date >= today)),
        week:  sum(all.filter(p => p.start_date >= weekStart)),
        month: sum(all.filter(p => p.start_date >= monthStart)),
        total: sum(all),
      })
    })

    // Gelen üye (distinct member_id — completed ders)
    supabase.from('reservations').select('member_id, scheduled_date, members(name, surname)').eq('status', 'completed')
      .then(({ data: allCompleted }) => {
        const all = allCompleted ?? []
        const toMemList = (rows: any[]) => {
          const seen = new Map<string, string>()
          for (const r of rows) {
            if (!seen.has(r.member_id)) {
              const m = Array.isArray(r.members) ? r.members[0] : r.members
              seen.set(r.member_id, m ? `${m.name} ${m.surname}` : '—')
            }
          }
          return [...seen.entries()].map(([id, name]) => ({ id, name }))
        }
        const todayRows  = all.filter(r => r.scheduled_date === today)
        const weekRows   = all.filter(r => r.scheduled_date >= weekStart && r.scheduled_date <= today)
        const monthRows  = all.filter(r => r.scheduled_date >= monthStart && r.scheduled_date <= today)
        const visits = {
          today: toMemList(todayRows),
          week:  toMemList(weekRows),
          month: toMemList(monthRows),
          total: toMemList(all),
        }
        setRawVisits(visits)
        setVisitStats({ today: visits.today.length, week: visits.week.length, month: visits.month.length, total: visits.total.length })
      })
  }, [])

  // ---- Modal ----
  const openCard = async (key: LessonCardKey) => {
    setActiveCard(key)
    setModalLoading(true)
    setModalData([])
    const supabase = createClient()
    let q = supabase.from('reservations')
      .select('id, start_time, end_time, status, members(name, surname), trainers(name, surname)')
      .eq('scheduled_date', today).in('status', ['pending','approved','completed']).order('start_time')
    if (key === 'completed') q = q.eq('status', 'completed')
    if (key === 'pending')   q = q.eq('status', 'pending')
    if (key === 'remaining') q = q.in('status', ['approved', 'pending'])
    const { data } = await q
    setModalData((data ?? []).map((r: any) => {
      const m = Array.isArray(r.members) ? r.members[0] : r.members
      const t = Array.isArray(r.trainers) ? r.trainers[0] : r.trainers
      return { id: r.id, time: `${r.start_time?.substring(0,5)} – ${r.end_time?.substring(0,5)}`,
               member: m ? `${m.name} ${m.surname}` : 'Bilinmiyor',
               trainer: t ? `${t.name} ${t.surname}` : '—', status: r.status }
    }))
    setModalLoading(false)
  }

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
    await supabase.rpc('admin_cancel_reservation', { p_reservation_id: id })
    setModalData(prev => prev.filter(r => r.id !== id))
    setEditItem(null)
  }

  const MODAL_TITLE: Record<LessonCardKey, string> = {
    total: 'Bugünkü Tüm Dersler', completed: 'Tamamlanan Dersler',
    pending: 'Bekleyen Dersler', remaining: 'Kalan Dersler',
  }

  // ---- Kart satırı bileşeni ----
  function StatRow({ label, items }: { label: string; items: { title: string; value: number | string; color: string; onClick?: () => void }[] }) {
    return (
      <div className="mb-3">
        <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5 px-0.5" style={{ color: '#7b93c4' }}>{label}</p>
        <div className="grid grid-cols-4 gap-1.5">
          {items.map((item, i) => (
            <button key={i} onClick={item.onClick} disabled={!item.onClick}
              className="rounded-xl flex flex-col items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                       padding: '6px 4px', height: 52, cursor: item.onClick ? 'pointer' : 'default' }}>
              <p className="text-[8px] font-medium uppercase tracking-wide leading-tight mb-1 text-center" style={{ color: '#7b93c4' }}>{item.title}</p>
              <p className="text-base font-bold text-center" style={{ color: item.color }}>{item.value}</p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#7b93c4' }}>Bugün</p>
        <h1 className="text-2xl font-bold text-white">{dateLabel}</h1>
      </div>

      {/* Satır 1 — Dersler */}
      <StatRow label="Dersler (bugün)" items={[
        { title: 'Toplam', value: lessonStats.total,     color: '#38bdf8', onClick: () => openCard('total') },
        { title: 'Tamamlanan', value: lessonStats.completed, color: '#34d399', onClick: () => openCard('completed') },
        { title: 'Bekleyen', value: lessonStats.pending,   color: '#f59e0b', onClick: () => openCard('pending') },
        { title: 'Kalan',    value: lessonStats.remaining, color: '#c8d6f0', onClick: () => openCard('remaining') },
      ]} />

      {/* Satır 2 — Yeni Kayıt */}
      <StatRow label="Yeni Kayıt" items={[
        { title: 'Bugün',  value: memberStats.today, color: '#a78bfa', onClick: () => openGenericModal('member','today','Bugün Yeni Kayıtlar') },
        { title: 'Hafta',  value: memberStats.week,  color: '#a78bfa', onClick: () => openGenericModal('member','week','Bu Hafta Yeni Kayıtlar') },
        { title: 'Ay',     value: memberStats.month, color: '#a78bfa', onClick: () => openGenericModal('member','month','Bu Ay Yeni Kayıtlar') },
        { title: String(now.getFullYear()), value: memberStats.year, color: '#c8d6f0', onClick: () => openGenericModal('member','year',`${now.getFullYear()} ve Önceki Yıllar`) },
      ]} />

      {/* Satır 3 — Satılan Paket */}
      <StatRow label="Satılan Paket (₺)" items={[
        { title: 'Bugün',  value: packageStats.today  ? `${(packageStats.today/1000).toFixed(0)}K`  : '0', color: '#34d399', onClick: () => openGenericModal('package','today','Bugün Satılan Paketler') },
        { title: 'Hafta',  value: packageStats.week   ? `${(packageStats.week/1000).toFixed(0)}K`   : '0', color: '#34d399', onClick: () => openGenericModal('package','week','Bu Hafta Satılan Paketler') },
        { title: 'Ay',     value: packageStats.month  ? `${(packageStats.month/1000).toFixed(0)}K`  : '0', color: '#34d399', onClick: () => openGenericModal('package','month','Bu Ay Satılan Paketler') },
        { title: 'Toplam', value: packageStats.total  ? `${(packageStats.total/1000).toFixed(0)}K`  : '0', color: '#c8d6f0', onClick: () => openGenericModal('package','total','Tüm Satılan Paketler') },
      ]} />

      {/* Satır 4 — Gelen Üye */}
      <StatRow label="Gelen Üye" items={[
        { title: 'Bugün',  value: visitStats.today, color: '#f59e0b', onClick: () => openGenericModal('visit','today','Bugün Gelen Üyeler') },
        { title: 'Hafta',  value: visitStats.week,  color: '#f59e0b', onClick: () => openGenericModal('visit','week','Bu Hafta Gelen Üyeler') },
        { title: 'Ay',     value: visitStats.month, color: '#f59e0b', onClick: () => openGenericModal('visit','month','Bu Ay Gelen Üyeler') },
        { title: 'Toplam', value: visitStats.total, color: '#c8d6f0', onClick: () => openGenericModal('visit','total','Tüm Zamanlar Gelen Üyeler') },
      ]} />

      {/* Bekleyen başvurular */}
      <div className="mt-2 space-y-3">
        {pendingFirst > 0 && (
          <Link href="/admin/membership-requests" className="block">
            <div className="rounded-2xl p-4 flex items-center justify-between active:opacity-80"
              style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <div>
                <p className="font-bold text-white text-sm">{pendingFirst} İlk Paket Başvurusu</p>
                <p className="text-xs mt-0.5" style={{ color: '#f59e0b' }}>Yeni üye onayı bekliyor →</p>
              </div>
              <span className="text-2xl">🆕</span>
            </div>
          </Link>
        )}
        {pendingNew > 0 && (
          <Link href="/admin/membership-requests" className="block">
            <div className="rounded-2xl p-4 flex items-center justify-between active:opacity-80"
              style={{ background: 'rgba(56,189,248,0.10)', border: '1px solid rgba(56,189,248,0.3)' }}>
              <div>
                <p className="font-bold text-white text-sm">{pendingNew} Yeni Paket Başvurusu</p>
                <p className="text-xs mt-0.5" style={{ color: '#38bdf8' }}>Paket onayı bekliyor →</p>
              </div>
              <span className="text-2xl">📦</span>
            </div>
          </Link>
        )}
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
      </div>

      {/* Ders listesi modalı */}
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
              {!modalLoading && modalData.map((r, i) => (
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
            </div>
          </div>
        </div>
      )}

      {/* Genel modal — yeni kayıt / satılan paket / gelen üye */}
      {genericModal && (
        <div className="fixed inset-0 z-[70] flex items-end" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full rounded-t-3xl flex flex-col"
            style={{ background: '#0d1b4b', maxHeight: '75vh', border: '1px solid rgba(255,255,255,0.10)' }}>
            <div className="flex justify-between items-center px-5 py-4 flex-shrink-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <h3 className="text-base font-bold text-white">{genericModal.title}</h3>
              <button onClick={() => setGenericModal(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-lg font-bold"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#7b93c4' }}>✕</button>
            </div>
            <div className="overflow-y-auto flex-1 px-4 py-4 space-y-2">
              {genericLoading && <p className="text-center py-8 text-sm" style={{ color: '#7b93c4' }}>Yükleniyor...</p>}
              {!genericLoading && genericData.length === 0 && (
                <p className="text-center py-8 text-sm" style={{ color: '#7b93c4' }}>Kayıt bulunamadı.</p>
              )}
              {/* Yeni kayıt listesi */}
              {!genericLoading && genericModal.type === 'member' && genericModal.period !== 'year' && genericData.map((m, i) => (
                <a key={i} href={`/admin/members/${m.id}/settings`}
                  className="block rounded-2xl p-3 active:opacity-70"
                  style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)' }}>
                  <p className="text-sm font-bold text-white">{m.name} {m.surname}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#7b93c4' }}>{m.email} · {fmtDate(m.created_at?.substring(0,10))}</p>
                </a>
              ))}
              {/* Yeni kayıt — yıllara göre gruplu liste */}
              {!genericLoading && genericModal.type === 'member' && genericModal.period === 'year' && genericData.map((g, gi) => (
                <div key={gi} className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest px-0.5 pt-2" style={{ color: '#f59e0b' }}>{g.year} ({g.members.length})</p>
                  {g.members.map((m: any, i: number) => (
                    <a key={i} href={`/admin/members/${m.id}/settings`}
                      className="block rounded-2xl p-3 active:opacity-70"
                      style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)' }}>
                      <p className="text-sm font-bold text-white">{m.name} {m.surname}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#7b93c4' }}>{m.email} · {fmtDate(m.created_at?.substring(0,10))}</p>
                    </a>
                  ))}
                </div>
              ))}
              {/* Satılan paket listesi */}
              {!genericLoading && genericModal.type === 'package' && genericData.map((p, i) => (
                <div key={i} className="rounded-2xl p-3 flex justify-between items-center"
                  style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.15)' }}>
                  <div>
                    <p className="text-sm font-bold text-white">{p.member_name}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#7b93c4' }}>{p.total_lessons} ders · {fmtDate(p.start_date)}</p>
                  </div>
                  <p className="text-sm font-bold" style={{ color: '#34d399' }}>{parseFloat(p.payment_amount).toLocaleString('tr-TR')}₺</p>
                </div>
              ))}
              {/* Gelen üye listesi */}
              {!genericLoading && genericModal.type === 'visit' && genericData.map((m, i) => (
                <div key={i} className="rounded-2xl p-3"
                  style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.15)' }}>
                  <p className="text-sm font-bold text-white">{m.name}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Düzenleme modalı */}
      {editItem && (
        <div className="fixed inset-0 z-[80] flex items-end" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div className="w-full rounded-t-3xl p-6" style={{ background: '#0d1b4b', border: '1px solid rgba(255,255,255,0.10)' }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'rgba(255,255,255,0.15)' }} />
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
                style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}>Sil</button>
              <button onClick={handleEditRes} disabled={editSaving} className="flex-1 py-3 rounded-2xl font-bold text-sm disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#0a0f2e' }}>
                {editSaving ? '...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
