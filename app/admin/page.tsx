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

  const [stats, setStats] = useState({ total: 0, completed: 0, remaining: 0, newMembers: 0, pending: 0 })
  const [activeCard, setActiveCard]   = useState<CardKey | null>(null)
  const [modalData, setModalData]     = useState<any[]>([])
  const [modalLoading, setModalLoading] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('reservations').select('status').eq('scheduled_date', today).neq('status', 'cancelled'),
      supabase.from('membership_requests').select('id').eq('status', 'pending'),
      supabase.from('members').select('id').gte('created_at', weekAgo + 'T00:00:00').is('deleted_at', null),
    ]).then(([{ data: res }, { data: reqs }, { data: mem }]) => {
      setStats({
        total:      res?.length ?? 0,
        completed:  res?.filter(r => r.status === 'completed').length ?? 0,
        remaining:  res?.filter(r => r.status === 'approved' || r.status === 'pending').length ?? 0,
        newMembers: mem?.length ?? 0,
        pending:    reqs?.length ?? 0,
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
      const { data } = await supabase.from('members')
        .select('id, name, surname, email, phone, created_at')
        .gte('created_at', weekAgo + 'T00:00:00')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      setModalData(data ?? [])
    }
    setModalLoading(false)
  }

  const cards: { key: CardKey; label: string; value: number; icon: string; color: string }[] = [
    { key: 'total',       label: 'Toplam Ders',     value: stats.total,      icon: '📅', color: '#38bdf8' },
    { key: 'completed',   label: 'Tamamlandı',      value: stats.completed,  icon: '✅', color: '#34d399' },
    { key: 'remaining',   label: 'Kalan',           value: stats.remaining,  icon: '⏳', color: '#f59e0b' },
    { key: 'new_members', label: 'Yeni Kayıt (7g)', value: stats.newMembers, icon: '👤', color: '#a78bfa' },
  ]

  const MODAL_TITLE: Record<CardKey, string> = {
    total:       'Bugünkü Tüm Dersler',
    completed:   'Tamamlanan Dersler',
    remaining:   'Kalan Dersler',
    new_members: 'Son 7 Gün Yeni Kayıtlar',
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

      {stats.pending > 0 && (
        <Link href="/admin/membership-requests">
          <div className="rounded-2xl p-4 flex items-center justify-between active:opacity-80"
            style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)' }}>
            <div>
              <p className="font-bold text-white text-sm">{stats.pending} Bekleyen Üyelik Talebi</p>
              <p className="text-xs mt-0.5" style={{ color: '#f59e0b' }}>Onaylamak için tıkla →</p>
            </div>
            <span className="text-2xl">📋</span>
          </div>
        </Link>
      )}

      {/* Modal */}
      {activeCard && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.7)' }}>
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
                <div key={i} className="rounded-2xl p-3 flex justify-between items-center"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div>
                    <p className="text-sm font-bold text-white">{r.member}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#7b93c4' }}>{r.time} · {r.trainer}</p>
                  </div>
                  <span className="text-xs font-bold flex-shrink-0" style={{ color: STATUS_COLOR[r.status] ?? '#c8d6f0' }}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </div>
              ))}

              {/* Yeni üye listesi */}
              {!modalLoading && activeCard === 'new_members' && modalData.map((m: any, i: number) => (
                <div key={i} className="rounded-2xl p-3"
                  style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)' }}>
                  <p className="text-sm font-bold text-white">{m.name} {m.surname}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#7b93c4' }}>{m.email}</p>
                  <p className="text-xs" style={{ color: '#4a6190' }}>{fmtDate(m.created_at?.substring(0,10))}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
