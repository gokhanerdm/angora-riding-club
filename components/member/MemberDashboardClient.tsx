'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ReservationCalendar from './ReservationCalendar'
import WelcomeModal from './WelcomeModal'
import LogoutButton from '@/components/logout-button'

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
  _isFamily?: boolean
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
  stats, userId, memberName, trainerName, profilePhotoUrl, referralCode, adminMemberId
}: {
  stats: Stats
  userId: string
  memberName: string
  trainerName: string
  profilePhotoUrl?: string | null
  referralCode?: string | null
  adminMemberId?: string   // sadece admin görüntülerken gelir
}) {
  const router = useRouter()
  const [modal, setModal]           = useState<ModalType>(null)
  const [profileModal, setProfileModal] = useState(false)
  const [profileData, setProfileData]   = useState<any>(null)
  const [packages, setPackages] = useState<Package[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(false)
  const [cancelFeedback, setCancelFeedback] = useState<{ msg: string; ok: boolean } | null>(null)
  const [editRes, setEditRes]       = useState<Reservation | null>(null)
  const [editDate, setEditDate]     = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [trainers, setTrainers]     = useState<{id:string; name:string; surname:string}[]>([])

  // Paket düzenleme
  const [editPkg, setEditPkg]               = useState<Package | null>(null)
  const [editPkgStart, setEditPkgStart]     = useState('')
  const [editPkgEnd, setEditPkgEnd]         = useState('')
  const [editPkgType, setEditPkgType]       = useState('')
  const [editPkgTotal, setEditPkgTotal]     = useState('')
  const [editPkgAmount, setEditPkgAmount]   = useState('')
  const [editPkgMethod, setEditPkgMethod]   = useState('')
  const [editPkgSaving, setEditPkgSaving]   = useState(false)

  const openEditRes = async (res: Reservation) => {
    if (!adminMemberId) return
    setEditRes(res)
    setEditDate(res.scheduled_date)
    setEditStatus(res.status)
    if (trainers.length === 0) {
      const supabase = createClient()
      const { data } = await supabase.from('trainers').select('id, name, surname').order('name')
      setTrainers(data ?? [])
    }
  }

  const saveEditRes = async () => {
    if (!editRes) return
    const resId = editRes.id
    setEditSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let error: any = null
    if (editStatus === 'cancelled') {
      const res = await supabase.rpc('admin_cancel_reservation', { p_reservation_id: resId })
      error = res.error
    } else if (editStatus === 'completed' || editStatus === 'no_show') {
      const res = await supabase.rpc('mark_attendance', { p_reservation_id: resId, p_status: editStatus, p_marked_by: user?.id })
      error = res.error
    } else {
      const res = await supabase.from('reservations').update({ scheduled_date: editDate, status: editStatus }).eq('id', resId)
      error = res.error
    }

    setEditSaving(false)
    if (error) { alert('Hata: ' + error.message); return }
    setEditRes(null)
    setReservations(prev => prev.map(r =>
      r.id === resId ? { ...r, scheduled_date: editDate, status: editStatus } : r
    ))
  }

  const openProfile = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const targetUserId = adminMemberId
      ? (await supabase.from('members').select('user_id').eq('id', adminMemberId).single()).data?.user_id
      : user.id
    if (!targetUserId) { setProfileData({}); setProfileModal(true); return }
    const { data } = await supabase.from('members').select(
      'name, surname, email, phone, date_of_birth, dogum_yeri, adres, emergency_contact_phone, meslek, ogretim_durumu, baba_adi, anne_adi, is_minor, veli_adi_soyadi, veli_telefon, veli_iliskisi, referral_code'
    ).eq('user_id', targetUserId).single()
    setProfileData(data ?? {})
    setProfileModal(true)
  }

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
      // Kendi paketleri
      const { data: ownPkgs } = await supabase
        .from('memberships')
        .select('id, type, total_lessons, used_lessons, reserved_lessons, start_date, end_date, is_current')
        .eq('member_id', memberId).is('family_id', null)
        .order('created_at', { ascending: false })
      // Aile paketi
      const { data: fm } = await supabase
        .from('family_members').select('family_id').eq('member_id', memberId).limit(1).maybeSingle()
      let familyPkgs: any[] = []
      if (fm?.family_id) {
        const { data: fp } = await supabase
          .from('memberships')
          .select('id, type, total_lessons, used_lessons, reserved_lessons, start_date, end_date, is_current')
          .eq('family_id', fm.family_id).order('created_at', { ascending: false })
        familyPkgs = (fp ?? []).map(p => ({ ...p, _isFamily: true }))
      }
      setPackages([...(ownPkgs ?? []), ...familyPkgs])
    } else {
      const statusFilter = type === 'used'
        ? ['completed', 'no_show']
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
    const supabase = createClient()

    // Admin ise 12 saat kuralı yok — direkt iptal + reserved_lessons düşür
    if (adminMemberId) {
      const { error } = await supabase.rpc('admin_cancel_reservation', {
        p_reservation_id: reservationId
      })
      if (!error) {
        setReservations(prev => prev.filter(r => r.id !== reservationId))
        setCancelFeedback({ msg: 'Ders iptal edildi.', ok: true })
        setTimeout(() => setCancelFeedback(null), 3000)
        router.refresh()
      }
      return
    }

    if (!canCancel(scheduledDate, startTime)) {
      setCancelFeedback({ msg: 'Ders başlamadan en az 12 saat önce iptal yapılabilir.', ok: false })
      setTimeout(() => setCancelFeedback(null), 3000)
      return
    }
    const { error } = await supabase.rpc('cancel_reservation', {
      p_reservation_id: reservationId, p_user_id: userId
    })
    if (error) {
      setCancelFeedback({ msg: error.message, ok: false })
      setTimeout(() => setCancelFeedback(null), 4000)
    } else {
      setReservations(prev => prev.filter(r => r.id !== reservationId))
      setCancelFeedback({ msg: 'Ders iptal edildi.', ok: true })
      setTimeout(() => setCancelFeedback(null), 3000)
      router.refresh()
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(160deg, #0a0f2e 0%, #0d1b4b 40%, #071428 100%)' }}
    >
      <WelcomeModal />
      {/* Header */}
      <div className="px-5 pt-12 pb-4 flex items-start justify-between">
        {/* İsme tıklayınca profil bilgileri */}
        <button className="flex items-center gap-3 text-left active:opacity-70" onClick={openProfile}>
          <div
            className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(245,158,11,0.4)' }}
          >
            {profilePhotoUrl
              ? <img src={profilePhotoUrl} alt={memberName} className="w-full h-full object-cover" />
              : <span className="text-2xl">🏇</span>
            }
          </div>
          <div>
            <p className="text-xs font-medium tracking-widest" style={{ color: '#7b93c4' }}>Hoş geldin</p>
            <h1 className="text-2xl font-bold text-white mt-0.5">{memberName}</h1>
            {trainerName && (
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <p className="text-xs font-medium" style={{ color: '#f59e0b' }}>Eğitmen: {trainerName}</p>
              </div>
            )}
          </div>
        </button>
        {/* Üyelik butonu her zaman görünür */}
        <a href={adminMemberId ? `/member/packages?uid=${userId}` : '/member/packages'}
          className="text-xs font-bold px-4 py-2.5 rounded-2xl flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff' }}>
          Üyelik
        </a>
      </div>

      {/* Ayarlar butonu — sadece admin görür, isim ile paketler arasında */}
      {adminMemberId && (
        <div className="px-5 mb-3">
          <a href={`/admin/members/${adminMemberId}/settings`}
            className="w-full py-2.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#c8d6f0', border: '1px solid rgba(255,255,255,0.10)' }}>
            ⚙️ Ayarlar
          </a>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-2 px-5 mb-5">
        {[
          { label: 'Toplam',    value: stats.total_lessons,     type: 'total' as ModalType,    accent: '#7b93c4' },
          { label: 'Kullanılan', value: stats.used_lessons,     type: 'used' as ModalType,     accent: '#7b93c4' },
          { label: 'Kalan',     value: stats.remaining_lessons, type: null,                    accent: '#34d399' },
          { label: 'Bekleyen',  value: stats.reserved_lessons,  type: 'reserved' as ModalType, accent: '#38bdf8' },
        ].map((card) => (
          <button
            key={card.label}
            onClick={() => card.type && openModal(card.type)}
            disabled={!card.type}
            className="rounded-2xl p-3 flex flex-col items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: '#7b93c4' }}>{card.label}</p>
            <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: '#7b93c4' }}>Ders</p>
            <p className="text-2xl font-bold mt-1" style={{ color: card.accent }}>{card.value}</p>
          </button>
        ))}
      </div>

      {/* Referans kodu */}
      {referralCode && (
        <div className="mx-5 mb-4 px-4 py-2.5 rounded-2xl flex items-center justify-between"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <p className="text-xs font-bold" style={{ color: '#7b93c4' }}>Referans Kodun</p>
          <p className="text-sm font-bold tracking-widest" style={{ color: '#f59e0b' }}>{referralCode}</p>
        </div>
      )}

      {/* Divider */}
      <div className="mx-5 mb-4" style={{ height: '1px', background: 'rgba(255,255,255,0.07)' }} />

      {/* Calendar label */}
      <p className="px-5 text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#7b93c4' }}>
        Rezervasyon Takvimi
      </p>

      {/* Calendar */}
      <div className="flex-1 px-2">
        <ReservationCalendar overrideUserId={adminMemberId ? userId : undefined} />
      </div>

      {/* Profil bilgileri modalı */}
      {profileModal && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full rounded-t-3xl flex flex-col" style={{ background: '#0d1b4b', maxHeight: '80vh', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex justify-between items-center px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-3">
                <h3 className="text-base font-bold text-white">Üye Bilgileri</h3>
                {!adminMemberId && (
                  <a href="/member/profile-edit" className="text-xs font-bold px-2.5 py-1 rounded-xl"
                    style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                    Düzenle
                  </a>
                )}
              </div>
              <button onClick={() => setProfileModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-lg font-bold"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#7b93c4' }}>✕</button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
              {profileData ? (
                <>
                  {[
                    { label: 'Ad Soyad', value: `${profileData.name ?? ''} ${profileData.surname ?? ''}`.trim() },
                    { label: 'Email', value: profileData.email },
                    { label: 'Telefon', value: profileData.phone },
                    { label: 'Doğum Yeri', value: profileData.dogum_yeri },
                    { label: 'Doğum Tarihi', value: profileData.date_of_birth },
                    { label: 'Acil İletişim', value: profileData.emergency_contact_phone },
                    { label: 'Baba Adı', value: profileData.baba_adi },
                    { label: 'Anne Adı', value: profileData.anne_adi },
                    { label: 'Meslek', value: profileData.meslek },
                    { label: 'Öğrenim', value: profileData.ogretim_durumu },
                    { label: 'Adres', value: profileData.adres },
                    { label: 'Referans Kodu', value: profileData.referral_code },
                  ].filter(r => r.value).map(row => (
                    <div key={row.label} className="flex justify-between items-start gap-4 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <p className="text-xs font-bold flex-shrink-0" style={{ color: '#7b93c4' }}>{row.label}</p>
                      <p className="text-sm text-white text-right">{row.value}</p>
                    </div>
                  ))}
                  {profileData.is_minor && profileData.veli_adi_soyadi && (
                    <div className="rounded-2xl p-3 mt-2" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                      <p className="text-xs font-bold mb-2" style={{ color: '#f59e0b' }}>Veli Bilgileri</p>
                      {[
                        { label: 'Veli Adı', value: profileData.veli_adi_soyadi },
                        { label: 'Telefon', value: profileData.veli_telefon },
                        { label: 'Yakınlık', value: profileData.veli_iliskisi },
                      ].filter(r => r.value).map(row => (
                        <div key={row.label} className="flex justify-between py-1">
                          <p className="text-xs" style={{ color: '#7b93c4' }}>{row.label}</p>
                          <p className="text-xs font-bold text-white">{row.value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-center py-8 text-sm" style={{ color: '#7b93c4' }}>Yükleniyor...</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Ders düzenleme modalı (sadece admin) */}
      {editRes && (
        <div className="fixed inset-0 z-[60] flex items-end" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="w-full rounded-t-3xl p-6" style={{ background: '#0d1b4b', border: '1px solid rgba(255,255,255,0.10)' }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'rgba(255,255,255,0.15)' }} />
            <h3 className="text-base font-bold text-white mb-4">Ders Düzenle</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs mb-1 font-bold" style={{ color: '#7b93c4' }}>Tarih</p>
                <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)', color: '#c8d6f0' }} />
              </div>
              <div>
                <p className="text-xs mb-2 font-bold" style={{ color: '#7b93c4' }}>Durum</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: 'completed', label: 'Tamamlandı', color: '#34d399' },
                    { val: 'no_show',   label: 'Gelmedi',    color: '#f59e0b' },
                    { val: 'cancelled', label: 'İptal',      color: '#f87171' },
                  ].map(s => (
                    <button key={s.val} onClick={() => setEditStatus(s.val)}
                      className="py-2.5 rounded-xl text-xs font-bold"
                      style={editStatus === s.val
                        ? { background: `${s.color}22`, color: s.color, border: `1px solid ${s.color}55` }
                        : { background: 'rgba(255,255,255,0.05)', color: '#7b93c4', border: '1px solid rgba(255,255,255,0.08)' }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditRes(null)} className="flex-1 py-3 rounded-2xl font-bold text-sm"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#7b93c4' }}>Vazgeç</button>
              <button onClick={async () => {
                if (!editRes) return
                const resId = editRes.id
                setEditSaving(true)
                const supabase = createClient()
                const { error } = await supabase.rpc('admin_cancel_reservation', { p_reservation_id: resId })
                setEditSaving(false)
                if (error) { alert('Hata: ' + error.message); return }
                setEditRes(null)
                setReservations(prev => prev.filter(r => r.id !== resId))
                setModal(null)
              }} disabled={editSaving} className="py-3 px-4 rounded-2xl font-bold text-sm disabled:opacity-50"
                style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}>
                Sil
              </button>
              <button onClick={saveEditRes} disabled={editSaving} className="flex-1 py-3 rounded-2xl font-bold text-sm disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#0a0f2e' }}>
                {editSaving ? '...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Paket düzenleme modalı */}
      {editPkg && adminMemberId && (
        <div className="fixed inset-0 z-[70] flex items-end" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="w-full rounded-t-3xl p-6 pb-32 space-y-4" style={{ background: '#0d1b4b', border: '1px solid rgba(255,255,255,0.10)' }}>
            <div className="w-10 h-1 rounded-full mx-auto" style={{ background: 'rgba(255,255,255,0.15)' }} />
            <h3 className="font-bold text-white text-base">Paket Düzenle</h3>

            <div>
              <p className="text-xs mb-1 font-bold" style={{ color: '#7b93c4' }}>Toplam Ders</p>
              <input type="number" value={editPkgTotal} onChange={e => setEditPkgTotal(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)', color: '#c8d6f0' }} />
            </div>

            <div>
              <p className="text-xs mb-2 font-bold" style={{ color: '#7b93c4' }}>Tip</p>
              <div className="flex gap-2">
                {(['weekday','general'] as const).map(t => (
                  <button key={t} onClick={() => setEditPkgType(t)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                    style={editPkgType === t ? { background: '#f59e0b', color: '#0a0f2e' } : { background: 'rgba(255,255,255,0.06)', color: '#7b93c4' }}>
                    {t === 'weekday' ? 'Hafta İçi' : 'Genel'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs mb-1 font-bold" style={{ color: '#7b93c4' }}>Başlangıç</p>
                <input type="date" value={editPkgStart} onChange={e => setEditPkgStart(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)', color: '#c8d6f0' }} />
              </div>
              <div>
                <p className="text-xs mb-1 font-bold" style={{ color: '#7b93c4' }}>Bitiş</p>
                <input type="date" value={editPkgEnd} onChange={e => setEditPkgEnd(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)', color: '#c8d6f0' }} />
              </div>
            </div>

            <div>
              <p className="text-xs mb-1 font-bold" style={{ color: '#7b93c4' }}>Ödeme Tutarı (₺)</p>
              <input type="number" value={editPkgAmount} onChange={e => setEditPkgAmount(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)', color: '#c8d6f0' }} />
            </div>

            <div>
              <p className="text-xs mb-2 font-bold" style={{ color: '#7b93c4' }}>Ödeme Yöntemi</p>
              <div className="flex gap-2">
                {(['nakit','havale','kart'] as const).map(m => (
                  <button key={m} onClick={() => setEditPkgMethod(m)}
                    className="flex-1 py-2 rounded-xl text-xs font-bold capitalize"
                    style={editPkgMethod === m ? { background: '#f59e0b', color: '#0a0f2e' } : { background: 'rgba(255,255,255,0.06)', color: '#7b93c4' }}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditPkg(null)} className="flex-1 py-3 rounded-2xl font-bold text-sm"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#7b93c4' }}>Vazgeç</button>
              <button onClick={async () => {
                if (!editPkg) return
                setEditPkgSaving(true)
                const supabase = createClient()
                const [msRes, ptRes] = await Promise.all([
                  supabase.from('memberships').update({
                    total_lessons: parseInt(editPkgTotal),
                    type: editPkgType,
                    start_date: editPkgStart || null,
                    end_date: editPkgEnd || null,
                  }).eq('id', editPkg.id),
                  editPkgAmount ? supabase.from('payment_transactions').update({
                    amount: parseFloat(editPkgAmount),
                    payment_method: editPkgMethod,
                  }).eq('membership_id', editPkg.id).is('deleted_at', null) : Promise.resolve({ error: null }),
                ])
                setEditPkgSaving(false)
                if (msRes.error) { alert('Hata: ' + msRes.error.message); return }
                setPackages(prev => prev.map(p => p.id === editPkg.id
                  ? { ...p, total_lessons: parseInt(editPkgTotal), type: editPkgType, start_date: editPkgStart, end_date: editPkgEnd }
                  : p))
                setEditPkg(null)
              }} disabled={editPkgSaving} className="flex-1 py-3 rounded-2xl font-bold text-sm disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#0a0f2e' }}>
                {editPkgSaving ? '...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Çıkış — sadece üye kendi sayfasında görür */}
      {!adminMemberId && (
        <div className="px-5 pb-10 pt-2 flex justify-center">
          <LogoutButton className="text-xs font-bold text-amber-400 px-4 py-2 rounded-xl transition-opacity hover:text-amber-300" />
        </div>
      )}

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
              {cancelFeedback && (
                <div
                  className="px-4 py-3 rounded-2xl text-sm font-bold text-center"
                  style={{
                    background: cancelFeedback.ok ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)',
                    color:      cancelFeedback.ok ? '#34d399' : '#f87171',
                    border:     `1px solid ${cancelFeedback.ok ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
                  }}
                >
                  {cancelFeedback.msg}
                </div>
              )}
              {loading && <p className="text-center py-8 text-sm" style={{ color: '#7b93c4' }}>Yükleniyor...</p>}

              {!loading && modal === 'total' && (
                <>
                  {packages.length === 0 && <p className="text-center py-8 text-sm" style={{ color: '#7b93c4' }}>Paket bulunamadı.</p>}
                  {packages.map(pkg => (
                    <div
                      key={pkg.id}
                      onClick={async () => {
                        if (!adminMemberId) return
                        setEditPkg(pkg); setEditPkgStart(pkg.start_date ?? ''); setEditPkgEnd(pkg.end_date ?? ''); setEditPkgType(pkg.type ?? 'weekday'); setEditPkgTotal(String(pkg.total_lessons)); setEditPkgAmount(''); setEditPkgMethod('nakit')
                        const supabase = createClient()
                        const { data: pt } = await supabase.from('payment_transactions').select('amount, payment_method').eq('membership_id', pkg.id).is('deleted_at', null).limit(1).maybeSingle()
                        if (pt) { setEditPkgAmount(String(pt.amount ?? '')); setEditPkgMethod(pt.payment_method ?? 'nakit') }
                      }}
                      className="p-4 rounded-2xl"
                      style={{
                        background: pkg.is_current ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${pkg.is_current ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)'}`,
                        cursor: adminMemberId ? 'pointer' : 'default'
                      }}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-white text-sm">{pkg.total_lessons} Ders{pkg._isFamily ? ' (Aile)' : ''}</span>
                        <div className="flex items-center gap-2">
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-bold"
                            style={pkg.is_current
                              ? { background: '#f59e0b', color: '#fff' }
                              : { background: 'rgba(255,255,255,0.08)', color: '#7b93c4' }}
                          >
                            {pkg.is_current ? 'Aktif' : 'Geçmiş'}
                          </span>
                          {adminMemberId && (
                            <button
                              onClick={async () => {
                                const supabase = createClient()
                                const { data: { user } } = await supabase.auth.getUser()
                                if (!user) return
                                const { error } = await supabase.rpc('delete_membership', {
                                  p_membership_id: pkg.id,
                                  p_admin_id: user.id,
                                })
                                if (!error) {
                                  setPackages(prev => prev.filter(p => p.id !== pkg.id))
                                }
                              }}
                              className="text-xs px-2 py-0.5 rounded-xl font-bold"
                              style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}
                            >
                              Sil
                            </button>
                          )}
                        </div>
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
                      onClick={() => adminMemberId && openEditRes(res)}
                      className="p-3 rounded-2xl flex justify-between items-center"
                      style={{
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                        cursor: adminMemberId ? 'pointer' : 'default'
                      }}
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
                      {(canCancel(res.scheduled_date, res.start_time) || adminMemberId) ? (
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
