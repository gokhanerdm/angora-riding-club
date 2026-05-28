'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Stats {
  total_lessons: number
  used_lessons: number
  remaining_lessons: number
  reserved_lessons: number
}

interface Package {
  id: string
  type: string
  total_lessons: number
  used_lessons: number
  reserved_lessons: number
  start_date: string
  end_date: string
  is_current: boolean
}

interface Reservation {
  id: string
  scheduled_date: string
  start_time: string
  end_time: string
  status: string
}

const MONTHS_TR = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]} ${d.getFullYear()}`
}

function formatTime(timeStr: string) {
  return timeStr.substring(0, 5)
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    pending: 'Beklemede',
    approved: 'Onaylı',
    cancelled: 'İptal',
    completed: 'Tamamlandı',
    no_show: 'Gelmedi',
  }
  return map[status] ?? status
}

function canCancel(scheduledDate: string, startTime: string) {
  const lessonDateTime = new Date(`${scheduledDate}T${startTime}`)
  const now = new Date()
  const diffHours = (lessonDateTime.getTime() - now.getTime()) / (1000 * 60 * 60)
  return diffHours >= 12
}

type ModalType = 'total' | 'used' | 'reserved' | null

export default function MemberDashboardClient({ stats, userId }: { stats: Stats, userId: string }) {
  const [modal, setModal] = useState<ModalType>(null)
  const [packages, setPackages] = useState<Package[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(false)

  const openModal = async (type: ModalType) => {
    setModal(type)
    setLoading(true)
    const supabase = createClient()

    if (type === 'total') {
      const { data } = await supabase
        .from('memberships')
        .select('id, type, total_lessons, used_lessons, reserved_lessons, start_date, end_date, is_current')
        .eq('member_id', await getMemberId(supabase, userId))
        .order('created_at', { ascending: false })
      setPackages(data ?? [])
    }

    if (type === 'used') {
      const { data } = await supabase
        .from('reservations')
        .select('id, scheduled_date, start_time, end_time, status')
        .eq('member_id', await getMemberId(supabase, userId))
        .in('status', ['completed', 'cancelled', 'no_show'])
        .order('scheduled_date', { ascending: false })
      setReservations(data ?? [])
    }

    if (type === 'reserved') {
      const { data } = await supabase
        .from('reservations')
        .select('id, scheduled_date, start_time, end_time, status')
        .eq('member_id', await getMemberId(supabase, userId))
        .in('status', ['pending', 'approved'])
        .order('scheduled_date', { ascending: true })
      setReservations(data ?? [])
    }

    setLoading(false)
  }

  const getMemberId = async (supabase: any, userId: string) => {
    const { data } = await supabase.from('members').select('id').eq('user_id', userId).single()
    return data?.id
  }

  const handleCancel = async (reservationId: string, scheduledDate: string, startTime: string) => {
  if (!canCancel(scheduledDate, startTime)) {
    alert('Dersi iptal etmek için en az 12 saat öncesinde işlem yapmanız gerekiyor.')
    return
  }
  if (!confirm('Bu dersi iptal etmek istediğinize emin misiniz?')) return

  const supabase = createClient()
  const { error } = await supabase.rpc('cancel_reservation', {
    p_reservation_id: reservationId,
    p_user_id: userId
  })

  if (error) {
    alert('İptal işlemi başarısız: ' + error.message)
  } else {
    alert('Ders iptal edildi.')
    setModal(null)
    window.location.reload()
  }
}

  const statCards = [
    { label: 'Toplam Ders', value: stats.total_lessons, icon: '📚', type: 'total' as ModalType },
    { label: 'Kullanılan Ders', value: stats.used_lessons, icon: '✅', type: 'used' as ModalType },
    { label: 'Kalan Ders', value: stats.remaining_lessons, icon: '⏳', type: null },
    { label: 'Rezerve Derslerim', value: stats.reserved_lessons, icon: '📅', type: 'reserved' as ModalType },
  ]

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
        {statCards.map((card) => (
          <div
            key={card.label}
            onClick={() => card.type && openModal(card.type)}
            className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 ${card.type ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
          >
            <div className="text-4xl mb-4">{card.icon}</div>
            <div className="text-4xl font-bold text-gray-900 mb-1">{card.value}</div>
            <div className="text-sm font-bold text-gray-900">{card.label}</div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                {modal === 'total' && 'Paketlerim'}
                {modal === 'used' && 'Geçmiş Dersler'}
                {modal === 'reserved' && 'Rezerve Derslerim'}
              </h3>
              <button onClick={() => setModal(null)} className="text-gray-500 hover:text-gray-900 text-2xl font-bold">✕</button>
            </div>

            {loading && <p className="text-center text-gray-500 py-8">Yükleniyor...</p>}

            {!loading && modal === 'total' && (
              <div className="space-y-3">
                {packages.length === 0 && <p className="text-gray-500 text-center py-8">Paket bulunamadı.</p>}
                {packages.map(pkg => (
                  <div key={pkg.id} className={`p-4 rounded-xl border ${pkg.is_current ? 'border-amber-400 bg-amber-50' : 'border-gray-200'}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-gray-900">{pkg.total_lessons} Ders</span>
                      <span className={`text-xs px-2 py-1 rounded-full font-bold ${pkg.is_current ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                        {pkg.is_current ? 'Aktif' : 'Geçmiş'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">{pkg.type === 'weekday' ? 'Hafta İçi' : 'Genel'}</div>
                    <div className="text-sm text-gray-500 mt-1">{formatDate(pkg.start_date)} — {formatDate(pkg.end_date)}</div>
                    <div className="text-sm text-gray-500">Kullanılan: {pkg.used_lessons} / Rezerve: {pkg.reserved_lessons}</div>
                  </div>
                ))}
              </div>
            )}

            {!loading && modal === 'used' && (
              <div className="space-y-2">
                {reservations.length === 0 && <p className="text-gray-500 text-center py-8">Geçmiş ders bulunamadı.</p>}
                {reservations.map(res => (
                  <div key={res.id} className="p-3 rounded-xl border border-gray-200 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-gray-900">{formatDate(res.scheduled_date)}</p>
                      <p className="text-sm text-gray-500">{formatTime(res.start_time)} — {formatTime(res.end_time)}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                      res.status === 'completed' ? 'bg-green-100 text-green-700' :
                      res.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {statusLabel(res.status)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {!loading && modal === 'reserved' && (
              <div className="space-y-3">
                {reservations.length === 0 && <p className="text-gray-500 text-center py-8">Rezerve ders bulunamadı.</p>}
                {reservations.map(res => (
                  <div key={res.id} className="p-4 rounded-xl border border-amber-400 bg-amber-50">
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <p className="font-bold text-gray-900">{formatDate(res.scheduled_date)}</p>
                        <p className="text-sm text-gray-500">{formatTime(res.start_time)} — {formatTime(res.end_time)}</p>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-full font-bold bg-blue-100 text-blue-700">
                        {statusLabel(res.status)}
                      </span>
                    </div>
                    {canCancel(res.scheduled_date, res.start_time) && (
                      <button
                        onClick={() => handleCancel(res.id, res.scheduled_date, res.start_time)}
                        className="w-full bg-red-50 text-red-600 font-bold py-2 rounded-lg hover:bg-red-100 text-sm"
                      >
                        İptal Et
                      </button>
                    )}
                    {!canCancel(res.scheduled_date, res.start_time) && (
                      <p className="text-xs text-gray-400 text-center">12 saat kuralı — iptal edilemez</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}