'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ReservationCalendar from './ReservationCalendar'
import WelcomeModal from './WelcomeModal'

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

function formatTime(t: string) { return t.substring(0, 5) }

function statusLabel(status: string) {
  const map: Record<string, string> = {
    pending: 'Beklemede', approved: 'Onaylı',
    cancelled: 'İptal', completed: 'Tamamlandı', no_show: 'Gelmedi',
  }
  return map[status] ?? status
}

function canCancel(scheduledDate: string, startTime: string) {
  const lessonDateTime = new Date(`${scheduledDate}T${startTime}`)
  return (lessonDateTime.getTime() - Date.now()) / (1000 * 60 * 60) >= 12
}

type ModalType = 'total' | 'used' | 'reserved' | null

export default function MemberDashboardClient({
  stats, userId, memberName, trainerName
}: {
  stats: Stats
  userId: string
  memberName: string
  trainerName: string
}) {
  const [modal, setModal] = useState<ModalType>(null)
  const [packages, setPackages] = useState<Package[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(false)

  const getMemberId = async (supabase: any) => {
    const { data } = await supabase.from('members').select('id').eq('user_id', userId).single()
    return data?.id
  }

  const openModal = async (type: ModalType) => {
    setModal(type)
    setLoading(true)
    const supabase = createClient()
    const memberId = await getMemberId(supabase)

    if (type === 'total') {
      const { data } = await supabase
        .from('memberships')
        .select('id, type, total_lessons, used_lessons, reserved_lessons, start_date, end_date, is_current')
        .eq('member_id', memberId)
        .order('created_at', { ascending: false })
      setPackages(data ?? [])
    } else {
      const statusFilter = type === 'used'
        ? ['completed', 'cancelled', 'no_show']
        : ['pending', 'approved']
      const { data } = await supabase
        .from('reservations')
        .select('id, scheduled_date, start_time, end_time, status')
        .eq('member_id', memberId)
        .in('status', statusFilter)
        .order('scheduled_date', { ascending: type === 'reserved' })
      setReservations(data ?? [])
    }
    setLoading(false)
  }

  const handleCancel = async (reservationId: string, scheduledDate: string, startTime: string) => {
    if (!canCancel(scheduledDate, startTime)) {
      alert('Dersi iptal etmek için en az 12 saat öncesinde işlem yapmanız gerekiyor.')
      return
    }
    if (!confirm('Bu dersi iptal etmek istediğinize emin misiniz?')) return
    const supabase = createClient()
    const { error } = await supabase.rpc('cancel_reservation', {
      p_reservation_id: reservationId, p_user_id: userId
    })
    if (error) alert('İptal başarısız: ' + error.message)
    else { alert('Ders iptal edildi.'); setModal(null); window.location.reload() }
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(160deg, #0a0f2e 0%, #0d1b4b 40%, #071428 100%)' }}
    >
      <WelcomeModal />
      {/* Header */}
      <div className="px-5 pt-12 pb-4 flex items-start justify-between">
        <div>
          <p className="text-xs font-medium tracking-widest" style={{ color: '#7b93c4' }}>
            Hoş geldin
          </p>
          <h1 className="text-3xl font-bold text-white mt-0.5">{memberName}</h1>
          {trainerName && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <p className="text-xs font-medium" style={{ color: '#f59e0b' }}>
                Eğitmen: {trainerName}
              </p>
            </div>
          )}
        </div>
        <a
          href="/member/packages"
          className="text-xs font-bold px-4 py-2.5 rounded-2xl"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff' }}
        >
          Üyelik
        </a>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-2 px-5 mb-5">
        {[
          { label: 'Toplam', value: stats.total_lessons, type: 'total' as ModalType, accent: '#7b93c4' },
          { label: 'Kullanılan', value: stats.used_lessons, type: 'used' as ModalType, accent: '#7b93c4' },
          { label: 'Kalan', value: stats.remaining_lessons, type: null, accent: '#34d399' },
          { label: 'Bekleyen', value: stats.reserved_lessons, type: 'reserved' as ModalType, accent: '#38bdf8' },
        ].map((card) => (
          <button
            key={card.label}
            onClick={() => card.type && openModal(card.type)}
            disabled={!card.type}
            className="rounded-2xl p-3 text-left"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <p className="text-[9px] font-medium mb-1.5 uppercase tracking-wide" style={{ color: '#7b93c4' }}>{card.label}</p>
            <p className="text-2xl font-bold" style={{ color: card.accent }}>{card.value}</p>
            <p className="text-[8px] mt-0.5" style={{ color: 'rgba(123,147,196,0.6)' }}>ders</p>
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="mx-5 mb-4" style={{ height: '1px', background: 'rgba(255,255,255,0.07)' }} />

      {/* Calendar label */}
      <p className="px-5 text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#7b93c4' }}>
        Rezervasyon Takvimi
      </p>

      {/* Calendar */}
      <div className="flex-1 px-2">
        <ReservationCalendar />
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div
            className="w-full rounded-t-3xl flex flex-col"
            style={{ background: '#0d1b4b', maxHeight: '75vh', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <div
              className="flex justify-between items-center px-5 py-4"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
            >
              <h3 className="text-base font-bold text-white">
                {modal === 'total' && 'Paketlerim'}
                {modal === 'used' && 'Kullanılan Dersler'}
                {modal === 'reserved' && 'Bekleyen Dersler'}
              </h3>
              <button
                onClick={() => setModal(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-lg font-bold"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#7b93c4' }}
              >✕</button>
            </div>

            <div className="overflow-y-auto flex-1 px-4 py-4 space-y-2">
              {loading && <p className="text-center py-8 text-sm" style={{ color: '#7b93c4' }}>Yükleniyor...</p>}

              {!loading && modal === 'total' && (
                <>
                  {packages.length === 0 && <p className="text-center py-8 text-sm" style={{ color: '#7b93c4' }}>Paket bulunamadı.</p>}
                  {packages.map(pkg => (
                    <div
                      key={pkg.id}
                      className="p-4 rounded-2xl"
                      style={{
                        background: pkg.is_current ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${pkg.is_current ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)'}`
                      }}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-white text-sm">{pkg.total_lessons} Ders</span>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-bold"
                          style={pkg.is_current
                            ? { background: '#f59e0b', color: '#fff' }
                            : { background: 'rgba(255,255,255,0.08)', color: '#7b93c4' }}
                        >
                          {pkg.is_current ? 'Aktif' : 'Geçmiş'}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: '#7b93c4' }}>{pkg.type === 'weekday' ? 'Hafta İçi' : 'Genel'}</p>
                      <p className="text-xs mt-1" style={{ color: 'rgba(123,147,196,0.6)' }}>{formatDate(pkg.start_date)} — {formatDate(pkg.end_date)}</p>
                      <p className="text-xs" style={{ color: 'rgba(123,147,196,0.6)' }}>Kullanılan: {pkg.used_lessons} · Rezerve: {pkg.reserved_lessons}</p>
                    </div>
                  ))}
                </>
              )}

              {!loading && modal === 'used' && (
                <>
                  {reservations.length === 0 && <p className="text-center py-8 text-sm" style={{ color: '#7b93c4' }}>Geçmiş ders bulunamadı.</p>}
                  {reservations.map(res => (
                    <div
                      key={res.id}
                      className="p-3 rounded-2xl flex justify-between items-center"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      <div>
                        <p className="font-bold text-white text-sm">{formatDate(res.scheduled_date)}</p>
                        <p className="text-xs" style={{ color: '#7b93c4' }}>{formatTime(res.start_time)} — {formatTime(res.end_time)}</p>
                      </div>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-bold"
                        style={
                          res.status === 'completed'
                            ? { background: 'rgba(52,211,153,0.15)', color: '#34d399' }
                            : res.status === 'cancelled'
                            ? { background: 'rgba(248,113,113,0.15)', color: '#f87171' }
                            : { background: 'rgba(255,255,255,0.08)', color: '#7b93c4' }
                        }
                      >
                        {statusLabel(res.status)}
                      </span>
                    </div>
                  ))}
                </>
              )}

              {!loading && modal === 'reserved' && (
                <>
                  {reservations.length === 0 && <p className="text-center py-8 text-sm" style={{ color: '#7b93c4' }}>Bekleyen ders bulunamadı.</p>}
                  {reservations.map(res => (
                    <div
                      key={res.id}
                      className="p-4 rounded-2xl"
                      style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.25)' }}
                    >
                      <div className="flex justify-between items-center mb-3">
                        <div>
                          <p className="font-bold text-white text-sm">{formatDate(res.scheduled_date)}</p>
                          <p className="text-xs" style={{ color: '#7b93c4' }}>{formatTime(res.start_time)} — {formatTime(res.end_time)}</p>
                        </div>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-bold"
                          style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8' }}
                        >
                          {statusLabel(res.status)}
                        </span>
                      </div>
                      {canCancel(res.scheduled_date, res.start_time) ? (
                        <button
                          onClick={() => handleCancel(res.id, res.scheduled_date, res.start_time)}
                          className="w-full py-2 rounded-xl text-xs font-bold"
                          style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171' }}
                        >
                          İptal Et
                        </button>
                      ) : (
                        <p className="text-xs text-center" style={{ color: 'rgba(123,147,196,0.5)' }}>12 saat kuralı — iptal edilemez</p>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
