'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import AdminBottomNav from '@/components/admin/AdminBottomNav'

const BTN = {
  base: 'w-full rounded-2xl px-5 py-4 text-left text-sm font-bold transition-opacity active:opacity-70',
  card: { background: 'rgba(27,59,47,0.05)', border: '1px solid rgba(27,59,47,0.10)' },
}

const INPUT_STYLE = { background: 'rgba(27,59,47,0.04)', border: '1px solid rgba(27,59,47,0.15)', color: '#1B3B2F' }

const SHIFT_OPTIONS = [
  { value: 'morning', label: 'Sabah' },
  { value: 'evening', label: 'Akşam' },
  { value: 'fullday', label: 'Tam Gün' },
]

export default function AdminMemberSettingsPage() {
  const params   = useParams()
  const memberId = params.id as string
  const router   = useRouter()

  const [member,   setMember]   = useState<any>(null)
  const [trainers, setTrainers] = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [toast,    setToast]    = useState('')

  const [trainerOpen,  setTrainerOpen]  = useState(false)
  const [bonusOpen,    setBonusOpen]    = useState(false)
  const [bonusInput,   setBonusInput]   = useState('1')
  const [addingBonus,  setAddingBonus]  = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [updatingTrainer, setUpdatingTrainer] = useState(false)

  // Link modal
  const [linkModal,      setLinkModal]      = useState(false)
  const [passiveMembers, setPassiveMembers] = useState<any[]>([])
  const [linkTarget,     setLinkTarget]     = useState('')
  const [linking,        setLinking]        = useState(false)

  // Promote modal
  const [promoteModal, setPromoteModal] = useState(false)
  const [bonusRate,    setBonusRate]    = useState('0')
  const [shift,        setShift]        = useState('fullday')
  const [promoting,    setPromoting]    = useState(false)
  const [promoteMsg,   setPromoteMsg]   = useState('')

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('members').select('id, name, surname, email, member_status, default_trainer_id').eq('id', memberId).is('deleted_at', null).single(),
      supabase.from('trainers').select('id, name, surname').is('deleted_at', null),
    ]).then(([{ data: m }, { data: t }]) => {
      setMember(m)
      setTrainers(t ?? [])
      setLoading(false)
    })
  }, [])

  const toggleStatus = async () => {
    if (!member) return
    setUpdatingStatus(true)
    const newStatus = member.member_status === 'active' ? 'inactive' : 'active'
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.rpc('set_member_status', { p_admin_id: user?.id, p_member_id: memberId, p_status: newStatus })
    setMember((p: any) => ({ ...p, member_status: newStatus }))
    setUpdatingStatus(false)
    showToast('Durum güncellendi ✓')
  }

  const updateTrainer = async (trainerId: string) => {
    setUpdatingTrainer(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.rpc('update_member_trainer', {
      p_member_id: memberId, p_trainer_id: trainerId || null, p_admin_id: user.id,
    })
    setUpdatingTrainer(false)
    if (error) showToast('Hata: ' + error.message)
    else {
      setMember((p: any) => ({ ...p, default_trainer_id: trainerId || null }))
      setTrainerOpen(false)
      showToast('Eğitmen güncellendi ✓')
    }
  }

  const handleAddBonus = async () => {
    setAddingBonus(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.rpc('add_bonus_lessons', {
      p_member_id: memberId, p_admin_id: user.id, p_lessons: parseInt(bonusInput) || 1,
    })
    setAddingBonus(false)
    if (error) showToast('Hata: ' + error.message)
    else { showToast(`${bonusInput} ders eklendi ✓`); setBonusOpen(false) }
  }

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
      p_new_member_id: memberId, p_passive_member_id: linkTarget, p_admin_id: user.id,
    })
    setLinking(false)
    if (error) showToast('Hata: ' + error.message)
    else { setLinkModal(false); showToast('Hesaplar bağlandı ✓'); router.push('/admin/members') }
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

  const trainerName = member?.default_trainer_id
    ? (trainers.find(t => t.id === member.default_trainer_id)
        ? `${trainers.find(t => t.id === member.default_trainer_id).name} ${trainers.find(t => t.id === member.default_trainer_id).surname}`
        : 'Atanmış')
    : 'Atanmamış'

  if (loading) return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: '#FBFBFB' }}>
      <p style={{ color: 'rgba(27,59,47,0.55)' }}>Yükleniyor...</p>
    </div>
  )

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto"
      style={{ background: '#FBFBFB' }}>

      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[110] px-5 py-3 rounded-2xl text-sm font-bold whitespace-nowrap"
          style={{ background: toast.includes('✓') ? 'rgba(52,211,153,0.25)' : 'rgba(248,113,113,0.25)', border: '1px solid rgba(255,255,255,0.2)' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-14 pb-4 sticky top-0"
        style={{ background: '#FBFBFB', borderBottom: '1px solid rgba(27,59,47,0.10)' }}>
        <button onClick={() => router.back()} className="font-bold text-sm px-3 py-2 rounded-xl"
          style={{ color: 'rgba(27,59,47,0.55)', background: 'rgba(27,59,47,0.06)' }}>← Geri</button>
        <div>
          <h2 className="font-bold">{member?.name} {member?.surname}</h2>
          <p className="text-xs" style={{ color: 'rgba(27,59,47,0.55)' }}>⚙️ Ayarlar</p>
        </div>
      </div>

      <div className="px-4 py-5 space-y-2.5 pb-40">

        {/* 1. Profili Düzenle */}
        <a href={`/admin/members/${memberId}/profile-edit`}
          className={BTN.base + ' flex items-center justify-between'}
          style={BTN.card}>
          <span style={{ color: '#1B3B2F' }}>✏️ Profili Düzenle</span>
          <span style={{ color: 'rgba(27,59,47,0.55)' }}>→</span>
        </a>

        {/* 2. Üye Durumu */}
        <button onClick={toggleStatus} disabled={updatingStatus}
          className={BTN.base + ' flex items-center justify-between disabled:opacity-50'}
          style={BTN.card}>
          <span style={{ color: '#1B3B2F' }}>
            {member?.member_status === 'active' ? '🟢' : '🔴'} Üye Durumu
          </span>
          <span className="text-xs font-bold px-3 py-1 rounded-xl"
            style={member?.member_status === 'active'
              ? { background: 'rgba(52,211,153,0.15)', color: '#34d399' }
              : { background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>
            {member?.member_status === 'active' ? 'Aktif' : 'Pasif'}
          </span>
        </button>

        {/* 3. Eğitmen */}
        <div className="rounded-2xl overflow-hidden" style={BTN.card}>
          <button onClick={() => setTrainerOpen(p => !p)}
            className={BTN.base + ' flex items-center justify-between'}
            style={{ background: 'transparent', border: 'none' }}>
            <span style={{ color: '#1B3B2F' }}>👤 Eğitmen</span>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: '#f59e0b' }}>{trainerName}</span>
              <span style={{ color: 'rgba(27,59,47,0.55)' }}>{trainerOpen ? '▲' : '▼'}</span>
            </div>
          </button>
          {trainerOpen && (
            <div className="px-4 pb-3 space-y-1.5" style={{ borderTop: '1px solid rgba(27,59,47,0.08)' }}>
              <button onClick={() => updateTrainer('')} disabled={updatingTrainer}
                className="w-full py-2.5 px-3 rounded-xl text-sm font-bold text-left mt-2"
                style={!member?.default_trainer_id
                  ? { background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b' }
                  : { background: 'rgba(27,59,47,0.04)', border: '1px solid rgba(27,59,47,0.08)', color: 'rgba(27,59,47,0.55)' }}>
                Atanmamış
              </button>
              {trainers.map(t => (
                <button key={t.id} onClick={() => updateTrainer(t.id)} disabled={updatingTrainer}
                  className="w-full py-2.5 px-3 rounded-xl text-sm font-bold text-left"
                  style={member?.default_trainer_id === t.id
                    ? { background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b' }
                    : { background: 'rgba(27,59,47,0.04)', border: '1px solid rgba(27,59,47,0.08)', color: '#1B3B2F' }}>
                  {t.name} {t.surname}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 4. Geçmiş Ders Ekle */}
        <a href={`/admin/members/${memberId}/legacy-lessons`}
          className={BTN.base + ' flex items-center justify-between'}
          style={BTN.card}>
          <span style={{ color: '#1B3B2F' }}>🕐 Geçmiş Ders Ekle</span>
          <span style={{ color: 'rgba(27,59,47,0.55)' }}>→</span>
        </a>

        {/* 5. Ekstra Ders Ekle */}
        <div className="rounded-2xl overflow-hidden" style={BTN.card}>
          <button onClick={() => setBonusOpen(p => !p)}
            className={BTN.base + ' flex items-center justify-between'}
            style={{ background: 'transparent', border: 'none' }}>
            <span style={{ color: '#1B3B2F' }}>➕ Ekstra Ders Ekle</span>
            <span style={{ color: 'rgba(27,59,47,0.55)' }}>{bonusOpen ? '▲' : '▼'}</span>
          </button>
          {bonusOpen && (
            <div className="px-4 pb-3 flex gap-2 items-center" style={{ borderTop: '1px solid rgba(27,59,47,0.08)' }}>
              <input type="number" min="1" max="50" value={bonusInput}
                onChange={e => setBonusInput(e.target.value)}
                className="w-20 mt-3 px-3 py-2 rounded-xl text-sm outline-none text-center"
                style={INPUT_STYLE} />
              <button onClick={handleAddBonus} disabled={addingBonus}
                className="flex-1 mt-3 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
                style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>
                {addingBonus ? '...' : 'Ekle'}
              </button>
            </div>
          )}
        </div>

        {/* 6. Eski Hesap Bağla */}
        <button onClick={() => { setLinkModal(true); loadPassiveMembers() }}
          className={BTN.base + ' flex items-center justify-between'}
          style={BTN.card}>
          <span style={{ color: '#1B3B2F' }}>🔗 Eski Hesap Bağla</span>
          <span style={{ color: 'rgba(27,59,47,0.55)' }}>→</span>
        </button>

        {/* 7. Eğitmen Olarak Ata */}
        <button onClick={() => { setPromoteModal(true); setBonusRate('0'); setShift('fullday'); setPromoteMsg('') }}
          className={BTN.base + ' flex items-center justify-between'}
          style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)' }}>
          <span style={{ color: '#1B3B2F' }}>🏇 Eğitmen Olarak Ata</span>
          <span style={{ color: '#38bdf8' }}>→</span>
        </button>
      </div>

      {/* Eski hesap modal */}
      {linkModal && (
        <div className="fixed inset-0 z-[110] flex items-end" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div className="w-full rounded-t-3xl p-6" style={{ background: '#FBFBFB', border: '1px solid rgba(27,59,47,0.10)' }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'rgba(27,59,47,0.12)' }} />
            <h3 className="text-lg font-bold mb-4">Eski Hesap Bağla</h3>
            <select value={linkTarget} onChange={e => setLinkTarget(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-4" style={INPUT_STYLE}>
              <option value="">Pasif üye seç...</option>
              {passiveMembers.map(m => <option key={m.id} value={m.id}>{m.name} {m.surname}</option>)}
            </select>
            {passiveMembers.length === 0 && <p className="text-xs mb-4 text-center" style={{ color: 'rgba(27,59,47,0.55)' }}>Pasif üye yok.</p>}
            <div className="flex gap-3">
              <button onClick={() => setLinkModal(false)} className="flex-1 py-3 rounded-2xl font-bold text-sm"
                style={{ background: 'rgba(27,59,47,0.08)', color: 'rgba(27,59,47,0.55)' }}>Vazgeç</button>
              <button onClick={handleLink} disabled={linking || !linkTarget}
                className="flex-1 py-3 rounded-2xl font-bold text-sm disabled:opacity-50"
                style={{ background: 'rgba(248,113,113,0.2)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}>
                {linking ? '...' : 'Bağla ve Aktar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Promote modal */}
      {promoteModal && (
        <div className="fixed inset-0 z-[110] flex items-end" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div className="w-full rounded-t-3xl p-6" style={{ background: '#FBFBFB', border: '1px solid rgba(27,59,47,0.10)' }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'rgba(27,59,47,0.12)' }} />
            <h3 className="text-lg font-bold mb-1">Eğitmen Olarak Ata</h3>
            <p className="text-sm mb-4" style={{ color: 'rgba(27,59,47,0.55)' }}>{member?.name} {member?.surname} eğitmen paneline taşınır.</p>
            <div className="space-y-3 mb-4">
              <div>
                <p className="text-xs mb-1 font-bold" style={{ color: 'rgba(27,59,47,0.55)' }}>Prim Oranı (%)</p>
                <input type="number" min="0" max="100" value={bonusRate} onChange={e => setBonusRate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={INPUT_STYLE} />
              </div>
              <div>
                <p className="text-xs mb-2 font-bold" style={{ color: 'rgba(27,59,47,0.55)' }}>Vardiya</p>
                <div className="grid grid-cols-3 gap-2">
                  {SHIFT_OPTIONS.map(s => (
                    <button key={s.value} onClick={() => setShift(s.value)}
                      className="py-2.5 rounded-xl text-sm font-bold"
                      style={shift === s.value ? { background: '#f59e0b', color: '#0a0f2e' } : { background: 'rgba(27,59,47,0.06)', color: 'rgba(27,59,47,0.55)' }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {promoteMsg && <p className="text-xs mb-3 px-3 py-2 rounded-xl" style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171' }}>{promoteMsg}</p>}
            <div className="flex gap-3">
              <button onClick={() => setPromoteModal(false)} disabled={promoting}
                className="flex-1 py-3 rounded-2xl font-bold text-sm disabled:opacity-50"
                style={{ background: 'rgba(27,59,47,0.08)', color: 'rgba(27,59,47,0.55)' }}>Vazgeç</button>
              <button onClick={handlePromote} disabled={promoting}
                className="flex-1 py-3 rounded-2xl font-bold text-sm disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #38bdf8, #0284c7)', color: '#fff' }}>
                {promoting ? 'Atanıyor...' : 'Onayla'}
              </button>
            </div>
          </div>
        </div>
      )}
      <AdminBottomNav />
    </div>
  )
}
