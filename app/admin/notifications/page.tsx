'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Notification = {
  type: 'lesson_ending' | 'no_lessons' | 'pending_first' | 'pending_new'
  member_name?: string
  member_email?: string
  remaining_lessons?: number
  request_count?: number
  message: string
}

const ICON: Record<string, string> = {
  pending_first: '🆕',
  pending_new:   '📦',
  no_lessons:    '🚨',
  lesson_ending: '⚠️',
}

const BORDER: Record<string, string> = {
  pending_first: 'rgba(245,158,11,0.3)',
  pending_new:   'rgba(56,189,248,0.3)',
  no_lessons:    'rgba(248,113,113,0.3)',
  lesson_ending: 'rgba(245,158,11,0.3)',
}

const BG: Record<string, string> = {
  pending_first: 'rgba(245,158,11,0.08)',
  pending_new:   'rgba(56,189,248,0.08)',
  no_lessons:    'rgba(248,113,113,0.08)',
  lesson_ending: 'rgba(245,158,11,0.08)',
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  const [legacyRequests, setLegacyRequests] = useState<any[]>([])
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const approveLegacy = async (memberId: string) => {
    setApprovingId(memberId)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setApprovingId(null); return }
    const { data: admin } = await supabase.from('profiles').select('id').eq('id', user.id).single()
    const { error } = await supabase.rpc('approve_legacy_member', { p_member_id: memberId, p_admin_id: admin?.id })
    if (!error) setLegacyRequests(prev => prev.map(m => m.id === memberId ? { ...m, _approved: true } : m))
    setApprovingId(null)
  }

  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('dismissed_notifications') ?? '[]')) }
    catch { return new Set() }
  })
  const dismiss = (key: string) => {
    setDismissed(prev => {
      const next = new Set(prev).add(key)
      localStorage.setItem('dismissed_notifications', JSON.stringify([...next]))
      return next
    })
  }

  const load = async () => {
    setLoading(true)
    const supabase = createClient()
    const items: Notification[] = []

    const [{ data: memberships }, { data: requests }, { data: legacyData }, { data: activeRes }] = await Promise.all([
      supabase.from('memberships').select('id, member_id, total_lessons, used_lessons, members(name, surname, email)').eq('is_current', true),
      supabase.from('membership_requests').select('id, member_id, members!inner(member_status)').eq('status', 'pending'),
      supabase.from('members').select('id, name, surname, email, created_at').eq('pending_legacy_setup', true).is('deleted_at', null),
      // Sayaç sütununa (reserved_lessons) güvenmek yerine gerçek bekleyen/onaylı rezervasyonları say —
      // sayaç zamanla sapabiliyor (drift), canlı sayım her zaman doğrudur
      supabase.from('reservations').select('membership_id').in('status', ['pending', 'approved']),
    ])
    setLegacyRequests(legacyData ?? [])

    const firstCount = (requests ?? []).filter((r: any) => {
      const m = Array.isArray(r.members) ? r.members[0] : r.members
      return m?.member_status === 'pending_club_approval'
    }).length
    const newCount = (requests ?? []).filter((r: any) => {
      const m = Array.isArray(r.members) ? r.members[0] : r.members
      return m?.member_status === 'active'
    }).length
    if (firstCount > 0) {
      items.push({ type: 'pending_first', request_count: firstCount, message: `${firstCount} ilk paket başvurusu bekliyor.` })
    }
    if (newCount > 0) {
      items.push({ type: 'pending_new', request_count: newCount, message: `${newCount} yeni paket başvurusu bekliyor.` })
    }

    const reservedByMs = new Map<string, number>()
    for (const r of activeRes ?? []) {
      if (!r.membership_id) continue
      reservedByMs.set(r.membership_id, (reservedByMs.get(r.membership_id) ?? 0) + 1)
    }

    const memberMap = new Map<string, { name: string; email: string; remaining: number }>()
    for (const m of memberships ?? []) {
      const member = Array.isArray(m.members) ? m.members[0] : m.members
      if (!member) continue
      const reserved = reservedByMs.get(m.id) ?? 0
      const remaining = m.total_lessons - (m.used_lessons ?? 0) - reserved
      const current = memberMap.get(m.member_id)
      if (!current || remaining < current.remaining) {
        memberMap.set(m.member_id, { name: `${member.name} ${member.surname}`, email: member.email, remaining })
      }
    }

    for (const [, data] of memberMap) {
      if (data.remaining <= 0) {
        items.push({ type: 'no_lessons', member_name: data.name, member_email: data.email, remaining_lessons: 0, message: `${data.name} adlı üyenin dersi kalmadı.` })
      } else if (data.remaining <= 3) {
        items.push({ type: 'lesson_ending', member_name: data.name, member_email: data.email, remaining_lessons: data.remaining, message: `${data.name} adlı üyenin ${data.remaining} dersi kaldı.` })
      }
    }

    setNotifications(items)
    setLoading(false)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Bildirimler</h1>

      {loading ? (
        <p className="text-center py-8" style={{ color: '#7b93c4' }}>Yükleniyor...</p>
      ) : (
        <div className="space-y-3">
          {/* Eski üye talepleri */}
          {legacyRequests.map(m => (
            <div key={m.id}
              className="rounded-2xl p-4 flex items-start gap-4"
              style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.3)' }}>
              <span className="text-2xl flex-shrink-0">🕐</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-white text-sm">{m.name} {m.surname} — Eski Üye Kaydı</p>
                <p className="text-xs mt-0.5" style={{ color: '#7b93c4' }}>{m.email}</p>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {m._approved ? (
                    <span className="text-xs font-bold" style={{ color: '#34d399' }}>✓ Onaylandı — üye listesinde görünüyor</span>
                  ) : (
                    <button
                      onClick={() => approveLegacy(m.id)}
                      disabled={approvingId === m.id}
                      className="text-xs font-bold px-3 py-1.5 rounded-full disabled:opacity-50"
                      style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.35)' }}
                    >{approvingId === m.id ? 'Onaylanıyor...' : '✓ Onayla'}</button>
                  )}
                  <Link href={`/admin/members/${m.id}/legacy-lessons`}
                    className="text-xs font-bold" style={{ color: '#a78bfa' }}>
                    Geçmiş bilgileri gir →
                  </Link>
                </div>
              </div>
            </div>
          ))}

          {notifications.length === 0 && legacyRequests.length === 0 && (
            <div className="rounded-2xl p-8 text-center" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#7b93c4' }}>
              Bekleyen bildirim yok.
            </div>
          )}
          {notifications.filter(n => !dismissed.has(n.message)).map((n, i) => (
            <div
              key={i}
              className="rounded-2xl p-4 flex items-start gap-4"
              style={{ background: BG[n.type], border: `1px solid ${BORDER[n.type]}` }}
            >
              <span className="text-2xl flex-shrink-0">{ICON[n.type]}</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-white text-sm">{n.message}</p>
                {n.member_email && <p className="text-xs mt-0.5" style={{ color: '#7b93c4' }}>{n.member_email}</p>}
                {(n.type === 'pending_first' || n.type === 'pending_new') && (
                  <Link href="/admin/membership-requests" className="text-xs font-bold mt-1 block" style={{ color: '#38bdf8' }}>
                    Başvurulara git →
                  </Link>
                )}
              </div>
              <button onClick={() => dismiss(n.message)}
                className="text-xs px-2 py-1 rounded-lg flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#7b93c4' }}>
                Tamam
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
