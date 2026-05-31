import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']
const DAYS_TR = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi']

function pad(n: number) { return String(n).padStart(2, '0') }

function todayKey() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }))
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function weekAgoKey() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }))
  d.setDate(d.getDate() - 7)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default async function AdminDashboard() {
  const supabase = await createClient()
  const today = todayKey()
  const weekAgo = weekAgoKey()

  const [
    { data: todayRes },
    { data: pendingReqs },
    { data: newMembers },
  ] = await Promise.all([
    supabase.from('reservations').select('status').eq('scheduled_date', today).neq('status', 'cancelled'),
    supabase.from('membership_requests').select('id').eq('status', 'pending'),
    supabase.from('members').select('id').gte('created_at', weekAgo + 'T00:00:00').is('deleted_at', null),
  ])

  const totalToday    = todayRes?.length ?? 0
  const completedToday = todayRes?.filter(r => r.status === 'completed').length ?? 0
  const remainingToday = todayRes?.filter(r => r.status === 'approved' || r.status === 'pending').length ?? 0
  const pendingCount  = pendingReqs?.length ?? 0
  const newMemberCount = newMembers?.length ?? 0

  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }))
  const dateLabel = `${DAYS_TR[now.getDay()]}, ${now.getDate()} ${MONTHS_TR[now.getMonth()]}`

  const cards = [
    { label: 'Toplam Ders',     value: totalToday,     icon: '📅', color: '#38bdf8' },
    { label: 'Tamamlandı',      value: completedToday, icon: '✅', color: '#34d399' },
    { label: 'Kalan',           value: remainingToday, icon: '⏳', color: '#f59e0b' },
    { label: 'Yeni Kayıt (7g)', value: newMemberCount, icon: '👤', color: '#a78bfa' },
  ]

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#7b93c4' }}>Bugün</p>
        <h1 className="text-2xl font-bold text-white">{dateLabel}</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        {cards.map(card => (
          <div
            key={card.label}
            className="rounded-2xl p-4"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="text-2xl mb-2">{card.icon}</div>
            <div className="text-3xl font-bold text-white mb-1">{card.value}</div>
            <div className="text-xs" style={{ color: '#7b93c4' }}>{card.label}</div>
          </div>
        ))}
      </div>

      {pendingCount > 0 && (
        <Link href="/admin/membership-requests">
          <div
            className="rounded-2xl p-4 flex items-center justify-between active:opacity-80"
            style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)' }}
          >
            <div>
              <p className="font-bold text-white text-sm">{pendingCount} Bekleyen Üyelik Talebi</p>
              <p className="text-xs mt-0.5" style={{ color: '#f59e0b' }}>Onaylamak için tıkla →</p>
            </div>
            <span className="text-2xl">📋</span>
          </div>
        </Link>
      )}
    </div>
  )
}
