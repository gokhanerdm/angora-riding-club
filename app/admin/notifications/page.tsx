'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type Notification = {
  type: 'lesson_ending' | 'no_lessons' | 'pending_request'
  member_name?: string
  member_email?: string
  remaining_lessons?: number
  request_count?: number
  message: string
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const supabase = createClient()
    const items: Notification[] = []

    const [{ data: memberships }, { data: requests }] = await Promise.all([
      supabase
        .from('memberships')
        .select('member_id, total_lessons, used_lessons, reserved_lessons, members(name, surname, email)')
        .eq('is_current', true),
      supabase
        .from('membership_requests')
        .select('id')
        .eq('status', 'pending')
    ])

    // Bekleyen talepler
    if ((requests ?? []).length > 0) {
      items.push({
        type: 'pending_request',
        request_count: requests!.length,
        message: `${requests!.length} bekleyen üyelik talebi var.`
      })
    }

    // Dersi biten veya bitecek üyeler
    const memberMap = new Map<string, { name: string; email: string; remaining: number }>()
    for (const m of memberships ?? []) {
      const member = Array.isArray(m.members) ? m.members[0] : m.members
      if (!member) continue
      const remaining = m.total_lessons - (m.used_lessons ?? 0) - (m.reserved_lessons ?? 0)
      const current = memberMap.get(m.member_id)
      if (!current || remaining < current.remaining) {
        memberMap.set(m.member_id, {
          name: `${member.name} ${member.surname}`,
          email: member.email,
          remaining
        })
      }
    }

    for (const [, data] of memberMap) {
      if (data.remaining <= 0) {
        items.push({
          type: 'no_lessons',
          member_name: data.name,
          member_email: data.email,
          remaining_lessons: 0,
          message: `${data.name} adlı üyenin dersi kalmadı.`
        })
      } else if (data.remaining <= 3) {
        items.push({
          type: 'lesson_ending',
          member_name: data.name,
          member_email: data.email,
          remaining_lessons: data.remaining,
          message: `${data.name} adlı üyenin ${data.remaining} dersi kaldı.`
        })
      }
    }

    setNotifications(items)
    setLoading(false)
  }

  const iconMap = {
    pending_request: '📋',
    no_lessons: '🚨',
    lesson_ending: '⚠️',
  }

  const colorMap = {
    pending_request: 'border-blue-200 bg-blue-50',
    no_lessons: 'border-red-200 bg-red-50',
    lesson_ending: 'border-yellow-200 bg-yellow-50',
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Bildirimler</h1>

      {loading ? <p className="text-gray-500">Yükleniyor...</p> : (
        <div className="space-y-3">
          {notifications.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
              Bekleyen bildirim yok.
            </div>
          )}
          {notifications.map((n, i) => (
            <div key={i} className={`rounded-xl border p-4 flex items-start gap-4 ${colorMap[n.type]}`}>
              <span className="text-2xl">{iconMap[n.type]}</span>
              <div>
                <p className="font-bold text-gray-900">{n.message}</p>
                {n.member_email && <p className="text-sm text-gray-500">{n.member_email}</p>}
                {n.type === 'pending_request' && (
                  <a href="/admin/membership-requests" className="text-sm text-blue-600 hover:underline font-bold">
                    Taleplere git →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}