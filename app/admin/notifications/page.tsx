'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Notification = {
  type: 'lesson_ending' | 'no_lessons'
  member_name?: string
  member_email?: string
  remaining_lessons?: number
  message: string
}

const ICON: Record<string, string> = {
  no_lessons:    '🚨',
  lesson_ending: '⚠️',
}

const BORDER: Record<string, string> = {
  no_lessons:    'rgba(248,113,113,0.3)',
  lesson_ending: 'rgba(245,158,11,0.3)',
}

const BG: Record<string, string> = {
  no_lessons:    'rgba(248,113,113,0.08)',
  lesson_ending: 'rgba(245,158,11,0.08)',
}

const MONTHS_TR = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]} ${d.getFullYear()} · ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function formatDate(dateStr: string) {
  const [y,m,d] = dateStr.split('-').map(Number)
  return `${d} ${MONTHS_TR[m-1]} ${y}`
}

type NewMember     = { id: string; name: string; surname: string; email: string; created_at: string }
type PackageRequest = { id: string; member_id: string; request_type: string; created_at: string; member_name: string; member_email: string }
type LegacyRequest  = { id: string; name: string; surname: string; email: string; created_at: string; _approved?: boolean }
type TrialLesson   = { id: string; member_name: string; scheduled_date: string; start_time: string; status: string; created_at: string }

const SECTION_ORDER = ['new_member', 'package_request', 'legacy', 'trial'] as const
type SectionKey = typeof SECTION_ORDER[number]

const SECTION_LABELS: Record<SectionKey, string> = {
  new_member:      'Yeni Üye Kaydı',
  package_request: 'Paket Talebi',
  legacy:          'Eski Üye Kaydı',
  trial:           'Deneme Dersi',
}

const SECTION_ICONS: Record<SectionKey, string> = {
  new_member:      '🆕',
  package_request: '📦',
  legacy:          '🕐',
  trial:           '🐎',
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const [newMembers,      setNewMembers]      = useState<NewMember[]>([])
  const [packageRequests, setPackageRequests] = useState<PackageRequest[]>([])
  const [legacyRequests,  setLegacyRequests]  = useState<LegacyRequest[]>([])
  const [trialLessons,    setTrialLessons]    = useState<TrialLesson[]>([])
  const [openSections, setOpenSections] = useState<Set<SectionKey>>(new Set())
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const toggleSection = (key: SectionKey) => {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  useEffect(() => { load() }, [])

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

    const [{ data: memberships }, { data: newMemberData }, { data: pkgRequestData }, { data: legacyData }, { data: trialData }] = await Promise.all([
      supabase.from('memberships').select('id, member_id, total_lessons, used_lessons, members(name, surname, email)').eq('is_current', true),
      supabase.from('members').select('id, name, surname, email, created_at').eq('member_status', 'pending_club_approval').is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('membership_requests').select('id, member_id, request_type, created_at, members!inner(name, surname, email, member_status)').eq('status', 'pending').eq('members.member_status', 'active').order('created_at', { ascending: false }),
      supabase.from('members').select('id, name, surname, email, created_at').eq('pending_legacy_setup', true).eq('member_status', 'pending_club_approval').is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('reservations').select('id, status, scheduled_date, start_time, created_at, members(name, surname)').eq('type', 'trial').order('created_at', { ascending: false }),
    ])

    setNewMembers(newMemberData ?? [])
    setPackageRequests((pkgRequestData ?? []).map((r: any) => {
      const m = Array.isArray(r.members) ? r.members[0] : r.members
      return { id: r.id, member_id: r.member_id, request_type: r.request_type, created_at: r.created_at, member_name: m ? `${m.name} ${m.surname}` : 'Bilinmiyor', member_email: m?.email ?? '' }
    }))
    setLegacyRequests(legacyData ?? [])
    setTrialLessons((trialData ?? []).map((r: any) => {
      const m = Array.isArray(r.members) ? r.members[0] : r.members
      return { id: r.id, member_name: m ? `${m.name} ${m.surname}` : 'Bilinmiyor', scheduled_date: r.scheduled_date, start_time: r.start_time, status: r.status, created_at: r.created_at }
    }))

    const memberMap = new Map<string, { name: string; email: string; remaining: number }>()
    for (const m of memberships ?? []) {
      const member = Array.isArray(m.members) ? m.members[0] : m.members
      if (!member) continue
      // Bildirim eşiği: rezervasyonlar dahil toplam kullanılmamış ders 3 veya altına düşünce
      const remaining = m.total_lessons - (m.used_lessons ?? 0)
      const current = memberMap.get(m.member_id)
      if (!current || remaining < current.remaining) {
        memberMap.set(m.member_id, { name: `${member.name} ${member.surname}`, email: member.email, remaining })
      }
    }

    for (const [, data] of memberMap) {
      if (data.remaining <= 0) {
        items.push({ type: 'no_lessons', member_name: data.name, member_email: data.email, remaining_lessons: 0, message: `${data.name} adlı üyenin dersi kalmadı.` })
      } else if (data.remaining <= 2) {
        items.push({ type: 'lesson_ending', member_name: data.name, member_email: data.email, remaining_lessons: data.remaining, message: `${data.name} adlı üyenin ${data.remaining} dersi kaldı.` })
      }
    }

    setNotifications(items)
    setLoading(false)
  }

  const SECTION_COUNTS: Record<SectionKey, number> = {
    new_member:      newMembers.length,
    package_request: packageRequests.length,
    legacy:          legacyRequests.filter(m => !m._approved).length,
    trial:           trialLessons.length,
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">İstekler</h1>

      {loading ? (
        <p className="text-center py-8" style={{ color: '#7b93c4' }}>Yükleniyor...</p>
      ) : (
        <div className="space-y-3">
          {/* 4 akordeon başlık */}
          {SECTION_ORDER.map(key => {
            const isOpen = openSections.has(key)
            const count  = SECTION_COUNTS[key]
            return (
              <div key={key} className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <button onClick={() => toggleSection(key)} className="w-full flex items-center justify-between px-4 py-3.5">
                  <span className="flex items-center gap-3">
                    <span className="text-xl">{SECTION_ICONS[key]}</span>
                    <span className="font-bold text-white text-sm">{SECTION_LABELS[key]}</span>
                    {count > 0 && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b' }}>{count}</span>
                    )}
                  </span>
                  <span className="text-sm" style={{ color: '#7b93c4' }}>{isOpen ? '▲' : '▼'}</span>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    {/* Yeni üye kaydı */}
                    {key === 'new_member' && (
                      newMembers.length === 0 ? <p className="text-xs pt-3" style={{ color: '#7b93c4' }}>Bekleyen yeni üye kaydı yok.</p> :
                      newMembers.map(m => (
                        <Link key={m.id} href={`/admin/members/${m.id}/view`}
                          className="block rounded-xl p-3 mt-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
                          <p className="font-bold text-white text-sm">{m.name} {m.surname}</p>
                          <p className="text-xs mt-0.5" style={{ color: '#7b93c4' }}>{m.email}</p>
                          <p className="text-xs mt-1" style={{ color: '#4a6190' }}>{formatDateTime(m.created_at)}</p>
                        </Link>
                      ))
                    )}

                    {/* Paket talebi */}
                    {key === 'package_request' && (
                      packageRequests.length === 0 ? <p className="text-xs pt-3" style={{ color: '#7b93c4' }}>Bekleyen paket talebi yok.</p> :
                      packageRequests.map(r => (
                        <Link key={r.id} href="/admin/membership-requests"
                          className="block rounded-xl p-3 mt-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
                          <p className="font-bold text-white text-sm">{r.member_name}</p>
                          <p className="text-xs mt-0.5" style={{ color: '#7b93c4' }}>{r.member_email}</p>
                          <p className="text-xs mt-1" style={{ color: '#4a6190' }}>{formatDateTime(r.created_at)} — {r.request_type === 'weekday' ? 'Hafta İçi' : 'Genel'}</p>
                        </Link>
                      ))
                    )}

                    {/* Eski üye kaydı */}
                    {key === 'legacy' && (
                      legacyRequests.length === 0 ? <p className="text-xs pt-3" style={{ color: '#7b93c4' }}>Bekleyen eski üye kaydı yok.</p> :
                      legacyRequests.map(m => (
                        <div key={m.id} className="rounded-xl p-3 mt-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
                          <p className="font-bold text-white text-sm">{m.name} {m.surname}</p>
                          <p className="text-xs mt-0.5" style={{ color: '#7b93c4' }}>{m.email}</p>
                          <p className="text-xs mt-1" style={{ color: '#4a6190' }}>{formatDateTime(m.created_at)}</p>
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
                      ))
                    )}

                    {/* Deneme dersi */}
                    {key === 'trial' && (
                      trialLessons.length === 0 ? <p className="text-xs pt-3" style={{ color: '#7b93c4' }}>Deneme dersi talebi yok.</p> :
                      trialLessons.map(t => (
                        <div key={t.id} className="rounded-xl p-3 mt-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
                          <p className="font-bold text-white text-sm">
                            {t.member_name}
                            <span className="ml-1 px-1 py-0.5 rounded font-bold text-[9px]"
                              style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b' }}>DD</span>
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: '#7b93c4' }}>{formatDate(t.scheduled_date)} — {t.start_time.substring(0,5)}</p>
                          <p className="text-xs mt-1" style={{ color: '#4a6190' }}>Talep: {formatDateTime(t.created_at)}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Ders azalan/kalmayan üye bildirimleri */}
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
