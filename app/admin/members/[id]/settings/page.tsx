'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'

const MONTHS_TR = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']
const SHIFT_OPTIONS = [
  { value: 'morning', label: 'Sabah' },
  { value: 'evening', label: 'Akşam' },
  { value: 'fullday', label: 'Tam Gün' },
]
const CARD = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }
const INPUT_STYLE = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: '#c8d6f0' }

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]} ${d.getFullYear()}`
}

const resStatusColor = (s: string) => ({ completed: '#34d399', cancelled: '#f87171', no_show: '#f59e0b', pending: '#7b93c4', approved: '#38bdf8' }[s] ?? '#7b93c4')
const resStatusLabel = (s: string) => ({ completed: 'Tamamlandı', cancelled: 'İptal', no_show: 'Gelmedi', pending: 'Beklemede', approved: 'Onaylı' }[s] ?? s)

export default function AdminMemberSettingsPage() {
  const params = useParams()
  const memberId = params.id as string
  const router = useRouter()

  const [member, setMember]       = useState<any>(null)
  const [trainers, setTrainers]   = useState<any[]>([])
  const [memberships, setMemberships] = useState<any[]>([])
  const [reservations, setReservations] = useState<any[]>([])
  const [packages, setPackages]   = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [toast, setToast]         = useState('')

  // Görev 3 state
  const [bonusInput, setBonusInput]     = useState('1')
  const [addingBonus, setAddingBonus]   = useState(false)
  const [packageModal, setPackageModal] = useState(false)
  const [pkgId, setPkgId]               = useState('')
  const [pkgType, setPkgType]           = useState<'weekday'|'general'>('weekday')
  const [pkgAmount, setPkgAmount]       = useState('')
  const [pkgMethod, setPkgMethod]       = useState<'nakit'|'havale'|'kart'>('nakit')
  const [pkgDate, setPkgDate]           = useState('')
  const [creatingPkg, setCreatingPkg]   = useState(false)
  const [resModal, setResModal]         = useState(false)
  const [resDate, setResDate]           = useState('')
  const [resTrainer, setResTrainer]     = useState('')
  const [resSlot, setResSlot]           = useState('')
  const [creatingRes, setCreatingRes]   = useState(false)

  const SLOTS = ['10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00']

  // Görev 6 — Hesap bağlama
  const [passiveMembers, setPassiveMembers] = useState<any[]>([])
  const [linkModal, setLinkModal]           = useState(false)
  const [linkTarget, setLinkTarget]         = useState('')
  const [linking, setLinking]               = useState(false)

  const loadPassiveMembers = async () => {
    const supabase = createClient()
    const { data } = await supabase.from('members').select('id, name, surname').eq('is_passive', true).is('deleted_at', null)
    setPassiveMembers(data ?? [])
  }

  const handleLink = async () => {
    if (!linkTarget) return
    setLinking(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.rpc('link_member_accounts', {
      p_new_member_id: memberId, p_passive_member_id: linkTarget, p_admin_id: user.id
    })
    setLinking(false)
    if (error) showToast('Hata: ' + error.message)
    else { setLinkModal(false); showToast('Hesaplar bağlandı ✓'); loadAll() }
  }

  // Promote modal
  const [promoteModal, setPromoteModal] = useState(false)
  const [bonusRate, setBonusRate]       = useState('0')
  const [shift, setShift]               = useState('fullday')
  const [promoting, setPromoting]       = useState(false)
  const [promoteMsg, setPromoteMsg]     = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    const supabase = createClient()
    const [
      { data: memberData },
      { data: trainersData },
      { data: membershipsData },
      { data: reservationsData },
      { data: packagesData },
    ] = await Promise.all([
      supabase.from('members').select('id, name, surname, email, phone, member_status, default_trainer_id').eq('id', memberId).single(),
      supabase.from('trainers').select('id, name, surname').is('deleted_at', null),
      supabase.from('memberships').select('*').eq('member_id', memberId).order('created_at', { ascending: false }),
      supabase.from('reservations').select('id, scheduled_date, start_time, status, trainers(name, surname)').eq('member_id', memberId).order('scheduled_date', { ascending: false }).limit(20),
      supabase.from('membership_packages').select('id, lesson_count, weekday_price, general_price').eq('is_active', true).gt('weekday_price', 0).order('lesson_count'),
    ])
    setMember(memberData)
    setTrainers(trainersData ?? [])
    setMemberships(membershipsData ?? [])
    setReservations(reservationsData ?? [])
    setPackages(packagesData ?? [])
    setLoading(false)
  }

  const updateStatus = async (status: string) => {
    const supabase = createClient()
    await supabase.from('members').update({ member_status: status }).eq('id', memberId)
    setMember((prev: any) => ({ ...prev, member_status: status }))
    showToast('Durum güncellendi ✓')
  }

  const updateTrainer = async (trainerId: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.rpc('update_member_trainer', {
      p_member_id: memberId, p_trainer_id: trainerId || null, p_admin_id: user.id,
    })
    if (error) showToast('Hata: ' + error.message)
    else {
      setMember((prev: any) => ({ ...prev, default_trainer_id: trainerId || null }))
      showToast('Eğitmen güncellendi ✓')
    }
  }

  const handleAddBonus = async () => {
    setAddingBonus(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.rpc('add_bonus_lessons', { p_member_id: memberId, p_admin_id: user.id, p_lessons: parseInt(bonusInput) || 1 })
    setAddingBonus(false)
    if (error) showToast('Hata: ' + error.message)
    else { showToast(`${bonusInput} ders eklendi ✓`); loadAll() }
  }

  const handleCreatePackage = async () => {
    if (!pkgId || !pkgAmount) { showToast('Paket ve tutar zorunlu'); return }
    setCreatingPkg(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.rpc('create_direct_membership', {
      p_member_id: memberId, p_admin_id: user.id, p_package_id: pkgId,
      p_request_type: pkgType, p_payment_amount: parseFloat(pkgAmount),
      p_payment_method: pkgMethod,
      p_start_date: pkgDate || new Date().toISOString().split('T')[0],
    })
    setCreatingPkg(false)
    if (error) showToast('Hata: ' + error.message)
    else { setPackageModal(false); showToast('Paket oluşturuldu ✓'); await loadAll() }
  }

  const handleCreateReservation = async () => {
    if (!resDate || !resTrainer || !resSlot) { showToast('Tarih, eğitmen ve saat zorunlu'); return }
    setCreatingRes(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [h, m] = resSlot.split(':').map(Number)
    const endH = Math.floor((h * 60 + m + 30) / 60)
    const endM = (h * 60 + m + 30) % 60
    const endTime = `${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}:00`
    const { error } = await supabase.rpc('create_admin_reservation', {
      p_member_id: memberId, p_admin_id: user.id, p_trainer_id: resTrainer,
      p_scheduled_date: resDate, p_start_time: resSlot + ':00', p_end_time: endTime,
    })
    setCreatingRes(false)
    if (error) showToast('Hata: ' + error.message)
    else { setResModal(false); showToast('Rezervasyon oluşturuldu ✓'); loadAll() }
  }

  const handlePromote = async () => {
    setPromoting(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.rpc('promote_member_to_trainer', {
      p_member_id: memberId, p_admin_id: user.id,
      p_bonus_rate: parseFloat(bonusRate) || 0, p_shift: shift,
    })
    setPromoting(false)
    if (error) setPromoteMsg('Hata: ' + error.message)
    else { setPromoteModal(false); router.push('/admin/members') }
  }

  if (loading) return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'linear-gradient(160deg, #0a0f2e, #0d1b4b, #071428)' }}>
      <p style={{ color: '#7b93c4' }}>Yükleniyor...</p>
    </div>
  )

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto"
      style={{ background: 'linear-gradient(160deg, #0a0f2e, #0d1b4b, #071428)' }}>

      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[110] px-5 py-3 rounded-2xl text-sm font-bold text-white whitespace-nowrap"
          style={{ background: toast.includes('✓') ? 'rgba(52,211,153,0.25)' : 'rgba(248,113,113,0.25)', border: '1px solid rgba(255,255,255,0.2)' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-14 pb-4 sticky top-0"
        style={{ background: '#0a0f2e', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <button onClick={() => router.back()}
          className="font-bold text-sm px-3 py-2 rounded-xl"
          style={{ color: '#7b93c4', background: 'rgba(255,255,255,0.06)' }}>
          ← Geri
        </button>
        <div>
          <h2 className="font-bold text-white">{member?.name} {member?.surname}</h2>
          <p className="text-xs" style={{ color: '#7b93c4' }}>⚙️ Ayarlar</p>
        </div>
      </div>

      <div className="px-4 py-6 space-y-4 pb-24">

        {/* Profil düzenle — en üstte */}
        <a href={`/admin/members/${memberId}/profile-edit`}
          className="w-full py-3 rounded-2xl text-sm font-bold text-center flex items-center justify-center gap-2"
          style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
          ✏️ Profili Düzenle
        </a>

        {/* Bilgiler */}
        <div className="rounded-2xl p-4 space-y-1" style={CARD}>
          <p className="text-sm font-bold text-white">{member?.name} {member?.surname}</p>
          <p className="text-xs" style={{ color: '#7b93c4' }}>{member?.email}</p>
          <p className="text-xs" style={{ color: '#7b93c4' }}>{member?.phone}</p>
        </div>

        {/* Üye Durumu */}
        <div className="rounded-2xl p-4" style={CARD}>
          <p className="text-xs font-bold mb-3" style={{ color: '#7b93c4' }}>Üye Durumu</p>
          <div className="flex gap-2">
            {['active','inactive'].map(s => (
              <button key={s} onClick={() => updateStatus(s)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={member?.member_status === s
                  ? { background: s === 'active' ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)', color: s === 'active' ? '#34d399' : '#f87171', border: `1px solid ${s === 'active' ? 'rgba(52,211,153,0.4)' : 'rgba(248,113,113,0.4)'}` }
                  : { background: 'rgba(255,255,255,0.05)', color: '#7b93c4', border: '1px solid rgba(255,255,255,0.08)' }}>
                {s === 'active' ? 'Aktif' : 'Pasif'}
              </button>
            ))}
          </div>
        </div>

        {/* Eğitmen */}
        <div className="rounded-2xl p-4" style={CARD}>
          <p className="text-xs font-bold mb-3" style={{ color: '#7b93c4' }}>Eğitmen</p>
          <div className="space-y-2">
            <button onClick={() => updateTrainer('')}
              className="w-full px-3 py-2.5 rounded-xl text-sm font-bold text-left"
              style={!member?.default_trainer_id
                ? { background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b' }
                : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#7b93c4' }}>
              Atanmamış
            </button>
            {trainers.map(t => (
              <button key={t.id} onClick={() => updateTrainer(t.id)}
                className="w-full px-3 py-2.5 rounded-xl text-sm font-bold text-left"
                style={member?.default_trainer_id === t.id
                  ? { background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b' }
                  : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#c8d6f0' }}>
                {t.name} {t.surname}
              </button>
            ))}
          </div>
        </div>

        {/* Paketler */}
        <div>
          <p className="text-sm font-bold text-white mb-2">Paketler</p>
          {memberships.length === 0
            ? <p className="text-xs" style={{ color: '#7b93c4' }}>Paket yok.</p>
            : memberships.map(m => (
              <div key={m.id} className="rounded-2xl p-4 mb-2"
                style={m.is_current ? { background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)' } : CARD}>
                <div className="flex justify-between mb-1">
                  <span className="font-bold text-white">{m.total_lessons} Ders</span>
                  <span className="text-xs font-bold" style={{ color: m.is_current ? '#f59e0b' : '#4a6190' }}>{m.is_current ? 'Aktif' : 'Geçmiş'}</span>
                </div>
                <p className="text-xs" style={{ color: '#7b93c4' }}>{formatDate(m.start_date)} — {formatDate(m.end_date)}</p>
                <p className="text-xs mt-0.5" style={{ color: '#7b93c4' }}>Kalan: {m.total_lessons - m.used_lessons - m.reserved_lessons} · Kullanılan: {m.used_lessons}</p>
              </div>
            ))
          }
        </div>

        {/* Rezervasyonlar */}
        <div>
          <p className="text-sm font-bold text-white mb-2">Son Rezervasyonlar</p>
          {reservations.length === 0
            ? <p className="text-xs" style={{ color: '#7b93c4' }}>Rezervasyon yok.</p>
            : reservations.map(r => {
              const trainer = Array.isArray(r.trainers) ? r.trainers[0] : r.trainers
              return (
                <div key={r.id} className="flex justify-between items-center py-3"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <p className="text-sm font-bold text-white">{formatDate(r.scheduled_date)}</p>
                    <p className="text-xs" style={{ color: '#7b93c4' }}>{r.start_time?.substring(0,5)}{trainer ? ` · ${trainer.name} ${trainer.surname}` : ''}</p>
                  </div>
                  <span className="text-xs font-bold" style={{ color: resStatusColor(r.status) }}>{resStatusLabel(r.status)}</span>
                </div>
              )
            })
          }
        </div>

        {/* Admin işlemleri */}
        <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.15)' }}>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#38bdf8' }}>Admin İşlemleri</p>

          {/* Ekstra ders */}
          <div className="flex gap-2 items-center">
            <input type="number" min="1" max="50" value={bonusInput} onChange={e => setBonusInput(e.target.value)}
              className="w-16 px-3 py-2 rounded-xl text-sm outline-none text-center" style={INPUT_STYLE} />
            <button onClick={handleAddBonus} disabled={addingBonus}
              className="flex-1 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
              style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>
              {addingBonus ? '...' : '+ Ders Ekle'}
            </button>
          </div>

          {/* Paket oluştur */}
          <button onClick={() => setPackageModal(true)}
            className="w-full py-2 rounded-xl text-sm font-bold"
            style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>
            📦 Paket Oluştur
          </button>

          {/* Eski hesap bağla */}
          <button onClick={() => { setLinkModal(true); loadPassiveMembers() }}
            className="w-full py-2 rounded-xl text-sm font-bold"
            style={{ background: 'rgba(248,113,113,0.10)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}>
            🔗 Eski Hesap Bağla
          </button>

          {/* Geçmiş ders ekle */}
          <a href={`/admin/members/${memberId}/legacy-lessons`}
            className="w-full py-2 rounded-xl text-sm font-bold text-center block"
            style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)' }}>
            🕐 Geçmiş Ders Ekle
          </a>

          {/* Rezervasyon yap */}
          <button onClick={() => setResModal(true)}
            className="w-full py-2 rounded-xl text-sm font-bold"
            style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)' }}>
            📅 Rezervasyon Yap
          </button>
        </div>

        {/* Eğitmen Olarak Ata */}
        <div className="pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={() => { setPromoteModal(true); setBonusRate('0'); setShift('fullday'); setPromoteMsg('') }}
            className="w-full py-2.5 rounded-xl text-sm font-bold"
            style={{ background: 'rgba(56,189,248,0.12)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.25)' }}>
            🏇 Eğitmen Olarak Ata
          </button>
        </div>
      </div>

      {/* Paket oluştur modal */}
      {packageModal && (
        <div className="fixed inset-0 z-[110] flex items-end" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div className="w-full rounded-t-3xl p-6" style={{ background: '#0d1b4b', border: '1px solid rgba(255,255,255,0.10)' }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'rgba(255,255,255,0.15)' }} />
            <h3 className="text-lg font-bold text-white mb-4">Paket Oluştur</h3>
            <div className="space-y-3">
              <select value={pkgId} onChange={e => setPkgId(e.target.value)} className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={INPUT_STYLE}>
                <option value="">Paket seç...</option>
                {packages.map(p => <option key={p.id} value={p.id}>{p.lesson_count} Ders</option>)}
              </select>
              <div className="flex gap-2">
                {(['weekday','general'] as const).map(t => (
                  <button key={t} onClick={() => setPkgType(t)} className="flex-1 py-2 rounded-xl text-sm font-bold"
                    style={pkgType === t ? { background: '#f59e0b', color: '#0a0f2e' } : { background: 'rgba(255,255,255,0.06)', color: '#7b93c4' }}>
                    {t === 'weekday' ? 'Hafta İçi' : 'Genel'}
                  </button>
                ))}
              </div>
              <input type="number" value={pkgAmount} onChange={e => setPkgAmount(e.target.value)} placeholder="Ödeme tutarı (₺)"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={INPUT_STYLE} />
              <div className="flex gap-2">
                {(['nakit','havale','kart'] as const).map(m => (
                  <button key={m} onClick={() => setPkgMethod(m)} className="flex-1 py-2 rounded-xl text-xs font-bold capitalize"
                    style={pkgMethod === m ? { background: '#f59e0b', color: '#0a0f2e' } : { background: 'rgba(255,255,255,0.06)', color: '#7b93c4' }}>
                    {m}
                  </button>
                ))}
              </div>
              <input type="date" value={pkgDate} onChange={e => setPkgDate(e.target.value)}
                placeholder="Başlangıç tarihi (boş=bugün)" className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={INPUT_STYLE} />
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setPackageModal(false)} className="flex-1 py-3 rounded-2xl font-bold text-sm" style={{ background: 'rgba(255,255,255,0.08)', color: '#7b93c4' }}>Vazgeç</button>
              <button onClick={handleCreatePackage} disabled={creatingPkg} className="flex-1 py-3 rounded-2xl font-bold text-sm disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#0a0f2e' }}>
                {creatingPkg ? '...' : 'Oluştur'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rezervasyon yap modal */}
      {resModal && (
        <div className="fixed inset-0 z-[110] flex items-end" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div className="w-full rounded-t-3xl p-6" style={{ background: '#0d1b4b', border: '1px solid rgba(255,255,255,0.10)' }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'rgba(255,255,255,0.15)' }} />
            <h3 className="text-lg font-bold text-white mb-4">Rezervasyon Yap</h3>
            <div className="space-y-3">
              <input type="date" value={resDate} onChange={e => setResDate(e.target.value)} className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={INPUT_STYLE} />
              <select value={resTrainer} onChange={e => setResTrainer(e.target.value)} className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={INPUT_STYLE}>
                <option value="">Eğitmen seç...</option>
                {trainers.map(t => <option key={t.id} value={t.id}>{t.name} {t.surname}</option>)}
              </select>
              <select value={resSlot} onChange={e => setResSlot(e.target.value)} className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={INPUT_STYLE}>
                <option value="">Saat seç...</option>
                {SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setResModal(false)} className="flex-1 py-3 rounded-2xl font-bold text-sm" style={{ background: 'rgba(255,255,255,0.08)', color: '#7b93c4' }}>Vazgeç</button>
              <button onClick={handleCreateReservation} disabled={creatingRes} className="flex-1 py-3 rounded-2xl font-bold text-sm disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#a78bfa,#7c3aed)', color: '#fff' }}>
                {creatingRes ? '...' : 'Oluştur'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hesap bağlama modal */}
      {linkModal && (
        <div className="fixed inset-0 z-[110] flex items-end" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div className="w-full rounded-t-3xl p-6" style={{ background: '#0d1b4b', border: '1px solid rgba(255,255,255,0.10)' }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'rgba(255,255,255,0.15)' }} />
            <h3 className="text-lg font-bold text-white mb-2">Eski Hesap Bağla</h3>
            <p className="text-sm mb-4" style={{ color: '#7b93c4' }}>Bu üyeyi pasif kayıttaki eski hesabıyla birleştir. Tüm geçmiş veriler aktarılır.</p>
            <select value={linkTarget} onChange={e => setLinkTarget(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-4" style={INPUT_STYLE}>
              <option value="">Pasif üye seç...</option>
              {passiveMembers.map(m => <option key={m.id} value={m.id}>{m.name} {m.surname}</option>)}
            </select>
            {passiveMembers.length === 0 && <p className="text-xs mb-4 text-center" style={{ color: '#7b93c4' }}>Pasif üye kaydı bulunamadı.</p>}
            <div className="flex gap-3">
              <button onClick={() => setLinkModal(false)} className="flex-1 py-3 rounded-2xl font-bold text-sm" style={{ background: 'rgba(255,255,255,0.08)', color: '#7b93c4' }}>Vazgeç</button>
              <button onClick={handleLink} disabled={linking || !linkTarget} className="flex-1 py-3 rounded-2xl font-bold text-sm disabled:opacity-50" style={{ background: 'rgba(248,113,113,0.2)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}>
                {linking ? '...' : 'Bağla ve Aktar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Promote modal */}
      {promoteModal && (
        <div className="fixed inset-0 z-[110] flex items-end" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div className="w-full rounded-t-3xl p-6" style={{ background: '#0d1b4b', border: '1px solid rgba(255,255,255,0.10)' }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'rgba(255,255,255,0.15)' }} />
            <h3 className="text-lg font-bold text-white mb-1">Eğitmen Olarak Ata</h3>
            <p className="text-sm mb-5" style={{ color: '#7b93c4' }}>{member?.name} {member?.surname} eğitmen paneline taşınır.</p>
            <div className="space-y-4 mb-5">
              <div>
                <p className="text-xs font-bold mb-2" style={{ color: '#7b93c4' }}>Prim Oranı (%)</p>
                <input type="number" min="0" max="100" value={bonusRate} onChange={e => setBonusRate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={INPUT_STYLE} />
              </div>
              <div>
                <p className="text-xs font-bold mb-2" style={{ color: '#7b93c4' }}>Vardiya</p>
                <div className="grid grid-cols-3 gap-2">
                  {SHIFT_OPTIONS.map(s => (
                    <button key={s.value} onClick={() => setShift(s.value)}
                      className="py-2.5 rounded-xl text-sm font-bold"
                      style={shift === s.value ? { background: '#f59e0b', color: '#0a0f2e' } : { background: 'rgba(255,255,255,0.06)', color: '#7b93c4' }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {promoteMsg && <p className="text-xs mb-4 px-3 py-2 rounded-xl" style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171' }}>{promoteMsg}</p>}
            <div className="flex gap-3">
              <button onClick={() => setPromoteModal(false)} disabled={promoting}
                className="flex-1 py-3 rounded-2xl font-bold text-sm disabled:opacity-50"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#7b93c4' }}>Vazgeç</button>
              <button onClick={handlePromote} disabled={promoting}
                className="flex-1 py-3 rounded-2xl font-bold text-sm disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #38bdf8, #0284c7)', color: '#fff' }}>
                {promoting ? 'Atanıyor...' : 'Onayla'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
