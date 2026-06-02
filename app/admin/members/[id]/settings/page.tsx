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
  const [loading, setLoading]     = useState(true)
  const [toast, setToast]         = useState('')

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
    ] = await Promise.all([
      supabase.from('members').select('id, name, surname, email, phone, member_status, default_trainer_id').eq('id', memberId).single(),
      supabase.from('trainers').select('id, name, surname').is('deleted_at', null),
      supabase.from('memberships').select('*').eq('member_id', memberId).order('created_at', { ascending: false }),
      supabase.from('reservations').select('id, scheduled_date, start_time, status, trainers(name, surname)').eq('member_id', memberId).order('scheduled_date', { ascending: false }).limit(20),
    ])
    setMember(memberData)
    setTrainers(trainersData ?? [])
    setMemberships(membershipsData ?? [])
    setReservations(reservationsData ?? [])
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

        {/* Eğitmen Olarak Ata */}
        <div className="pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={() => { setPromoteModal(true); setBonusRate('0'); setShift('fullday'); setPromoteMsg('') }}
            className="w-full py-2.5 rounded-xl text-sm font-bold"
            style={{ background: 'rgba(56,189,248,0.12)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.25)' }}>
            🏇 Eğitmen Olarak Ata
          </button>
        </div>
      </div>

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
