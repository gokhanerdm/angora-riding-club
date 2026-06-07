'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Notification = {
  type: 'lesson_ending' | 'no_lessons' | 'pending_request'
  member_name?: string
  member_email?: string
  remaining_lessons?: number
  request_count?: number
  message: string
}

const ICON: Record<string, string> = {
  pending_request: '📋',
  no_lessons: '🚨',
  lesson_ending: '⚠️',
}

const BORDER: Record<string, string> = {
  pending_request: 'rgba(56,189,248,0.3)',
  no_lessons: 'rgba(248,113,113,0.3)',
  lesson_ending: 'rgba(245,158,11,0.3)',
}

const BG: Record<string, string> = {
  pending_request: 'rgba(56,189,248,0.08)',
  no_lessons: 'rgba(248,113,113,0.08)',
  lesson_ending: 'rgba(245,158,11,0.08)',
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  const [legacyRequests, setLegacyRequests] = useState<any[]>([])
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
      supabase.from('membership_requests').select('id').eq('status', 'pending'),
      supabase.from('members').select('id, name, surname, email, created_at').eq('pending_legacy_setup', true).is('deleted_at', null),
      // Sayaç sütununa (reserved_lessons) güvenmek yerine gerçek bekleyen/onaylı rezervasyonları say —
      // sayaç zamanla sapabiliyor (drift), canlı sayım her zaman doğrudur
      supabase.from('reservations').select('membership_id').in('status', ['pending', 'approved']),
    ])
    setLegacyRequests(legacyData ?? [])

    if ((requests ?? []).length > 0) {
      items.push({ type: 'pending_request', request_count: requests!.length, message: `${requests!.length} bekleyen üyelik talebi var.` })
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
            <a key={m.id} href={`/admin/members/${m.id}/legacy-lessons`}
              className="rounded-2xl p-4 flex items-start gap-4 active:opacity-70"
              style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.3)' }}>
              <span className="text-2xl flex-shrink-0">🕐</span>
              <div className="min-w-0">
                <p className="font-bold text-white text-sm">{m.name} {m.surname} — Eski Üye Kaydı</p>
                <p className="text-xs mt-0.5" style={{ color: '#7b93c4' }}>{m.email}</p>
                <p className="text-xs font-bold mt-1" style={{ color: '#a78bfa' }}>Geçmiş bilgileri gir →</p>
              </div>
            </a>
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
                {n.type === 'pending_request' && (
                  <Link href="/admin/membership-requests" className="text-xs font-bold mt-1 block" style={{ color: '#38bdf8' }}>
                    Taleplere git →
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
