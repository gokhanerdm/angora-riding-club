'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'

const CARD  = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }
const INPUT = { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)', color: '#c8d6f0' }
const SLOTS = ['10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00']

export default function LegacyRequestPage() {
  const params   = useParams()
  const memberId = params.id as string
  const router   = useRouter()

  const [member,   setMember]   = useState<any>(null)
  const [trainers, setTrainers] = useState<any[]>([])
  const [packages, setPackages] = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [toast,    setToast]    = useState('')

  // Paket bilgileri
  const [pkgId,     setPkgId]     = useState('')
  const [pkgType,   setPkgType]   = useState<'weekday'|'general'>('weekday')
  const [pkgAmount, setPkgAmount] = useState('')
  const [pkgMethod, setPkgMethod] = useState<'nakit'|'havale'|'kart'>('nakit')
  const [pkgStart,  setPkgStart]  = useState('')
  const [pkgEnd,    setPkgEnd]    = useState('')

  // Dersler
  const emptyLesson = () => ({ date:'', trainer:'', status:'completed' as const, slot:'10:30' })
  const [lessons, setLessons] = useState<{date:string; trainer:string; status:'completed'|'no_show'; slot:string}[]>(
    Array.from({ length: 10 }, emptyLesson)
  )

  const showToast = (m: string) => { setToast(m); setTimeout(()=>setToast(''), 3000) }

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('members').select('id, name, surname, email').eq('id', memberId).single(),
      supabase.from('trainers').select('id, name, surname').is('deleted_at', null),
      supabase.from('membership_packages').select('id, lesson_count, weekday_price, general_price').eq('is_active', true).gt('weekday_price', 0).order('lesson_count'),
    ]).then(([{data:m},{data:t},{data:p}]) => {
      setMember(m)
      setTrainers(t ?? [])
      setPackages(p ?? [])
      if (t && t.length > 0) setLessons([{ date:'', trainer: t[0].id, status:'completed', slot:'10:30' }])
      setLoading(false)
    })
  }, [])

  const addBlock     = () => setLessons(prev => [...prev, ...Array.from({ length: 10 }, emptyLesson)])
  const updateLesson = (i: number, field: string, val: string) =>
    setLessons(prev => prev.map((l, idx) => idx === i ? {...l, [field]: val} : l))

  const handleSave = async () => {
    if (!pkgId || !pkgAmount) { showToast('Paket ve ödeme tutarı zorunlu'); return }
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Direkt üyelik oluştur
    const { error: pkgErr } = await supabase.rpc('create_direct_membership', {
      p_member_id:      memberId,
      p_admin_id:       user.id,
      p_package_id:     pkgId,
      p_request_type:   pkgType,
      p_payment_amount: parseFloat(pkgAmount),
      p_payment_method: pkgMethod,
      p_start_date:     pkgStart || new Date().toISOString().split('T')[0],
    })
    if (pkgErr) { showToast('Paket hatası: ' + pkgErr.message); setSaving(false); return }

    // Oluşturulan üyeliğin id'sini al
    const { data: ms } = await supabase
      .from('memberships').select('id').eq('member_id', memberId)
      .order('created_at', { ascending: false }).limit(1).single()

    // Geçmiş dersleri ekle
    const validLessons = lessons.filter(l => l.date && l.trainer)
    if (validLessons.length > 0 && ms?.id) {
      const lessonsData = validLessons.map(l => ({
        scheduled_date: l.date,
        trainer_id: l.trainer,
        status: l.status,
        start_time: l.slot + ':00',
        end_time: (() => {
          const [h,m] = l.slot.split(':').map(Number)
          const t = h*60+m+30
          return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}:00`
        })()
      }))
      const { error: lessonErr } = await supabase.rpc('add_legacy_lessons', {
        p_member_id: memberId, p_admin_id: user.id,
        p_membership_id: ms.id, p_lessons: JSON.stringify(lessonsData)
      })
      if (lessonErr) showToast('Ders ekleme hatası: ' + lessonErr.message)
    }

    // Talebi tamamlandı olarak işaretle
    await supabase.from('members').update({ pending_legacy_setup: false }).eq('id', memberId)

    setSaving(false)
    showToast('Kayıt tamamlandı ✓')
    setTimeout(() => router.push('/admin/notifications'), 1500)
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
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[120] px-5 py-3 rounded-2xl text-sm font-bold text-white whitespace-nowrap"
          style={{ background: toast.includes('✓') ? 'rgba(52,211,153,0.25)' : 'rgba(248,113,113,0.25)', border: '1px solid rgba(255,255,255,0.2)' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-14 pb-4 sticky top-0 z-10"
        style={{ background: '#0a0f2e', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <button onClick={() => router.back()} className="font-bold text-sm px-3 py-2 rounded-xl"
          style={{ color: '#7b93c4', background: 'rgba(255,255,255,0.06)' }}>← Geri</button>
        <div>
          <h2 className="font-bold text-white">Geçmiş Üyelik Girişi</h2>
          <p className="text-xs" style={{ color: '#a78bfa' }}>
            🕐 {member?.name} {member?.surname} — Eski Üye Talebi
          </p>
        </div>
      </div>

      <div className="px-4 py-6 space-y-5 pb-32">

        {/* Üye bilgisi */}
        <div className="rounded-2xl p-4" style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)' }}>
          <p className="text-sm font-bold text-white">{member?.name} {member?.surname}</p>
          <p className="text-xs mt-0.5" style={{ color: '#7b93c4' }}>{member?.email}</p>
        </div>

        {/* Paket bilgileri */}
        <div className="rounded-2xl p-4 space-y-3" style={CARD}>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#f59e0b' }}>Paket Bilgileri *</p>

          <select value={pkgId} onChange={e => setPkgId(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={INPUT}>
            <option value="">Paket seç...</option>
            {packages.map(p => <option key={p.id} value={p.id}>{p.lesson_count} Ders</option>)}
          </select>

          <div className="flex gap-2">
            {(['weekday','general'] as const).map(t => (
              <button key={t} onClick={() => setPkgType(t)} className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={pkgType === t ? { background: '#f59e0b', color: '#0a0f2e' } : { background: 'rgba(255,255,255,0.06)', color: '#7b93c4' }}>
                {t === 'weekday' ? 'Hafta İçi' : 'Genel'}
              </button>
            ))}
          </div>

          <input type="number" value={pkgAmount} onChange={e => setPkgAmount(e.target.value)}
            placeholder="Ödenen tutar (₺) *"
            className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={INPUT} />

          <div className="flex gap-2">
            {(['nakit','havale','kart'] as const).map(m => (
              <button key={m} onClick={() => setPkgMethod(m)} className="flex-1 py-2.5 rounded-xl text-xs font-bold capitalize"
                style={pkgMethod === m ? { background: '#f59e0b', color: '#0a0f2e' } : { background: 'rgba(255,255,255,0.06)', color: '#7b93c4' }}>
                {m}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs mb-1" style={{ color: '#7b93c4' }}>Başlangıç tarihi</p>
              <input type="date" value={pkgStart} onChange={e => setPkgStart(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-xs outline-none" style={INPUT} />
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: '#7b93c4' }}>Bitiş tarihi</p>
              <input type="date" value={pkgEnd} onChange={e => setPkgEnd(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-xs outline-none" style={INPUT} />
            </div>
          </div>
        </div>

        {/* Geçmiş dersler — tablo formatı */}
        <div className="rounded-2xl overflow-hidden" style={CARD}>
          {/* Başlıklar */}
          <div className="grid px-3 py-2" style={{ gridTemplateColumns: '130px 1fr 90px', gap: 6, background: 'rgba(245,158,11,0.08)', borderBottom: '1px solid rgba(245,158,11,0.2)' }}>
            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#f59e0b' }}>Tarih</p>
            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#f59e0b' }}>Eğitmen</p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-center" style={{ color: '#f59e0b' }}>Durum</p>
          </div>

          {/* Satırlar */}
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            {lessons.map((l, i) => (
              <div key={i} className="grid px-3 py-1.5 items-center" style={{ gridTemplateColumns: '130px 1fr 90px', gap: 6 }}>
                <input
                  type="date" value={l.date}
                  onChange={e => updateLesson(i, 'date', e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg text-xs outline-none"
                  style={INPUT}
                />
                <select
                  value={l.trainer}
                  onChange={e => updateLesson(i, 'trainer', e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg text-xs outline-none"
                  style={INPUT}
                >
                  <option value="">Seç</option>
                  {trainers.map(t => <option key={t.id} value={t.id}>{t.name} {t.surname}</option>)}
                </select>
                <div className="flex gap-1">
                  <button
                    onClick={() => updateLesson(i, 'status', 'completed')}
                    className="flex-1 py-1.5 rounded-lg text-[10px] font-bold"
                    style={l.status === 'completed'
                      ? { background: 'rgba(52,211,153,0.25)', color: '#34d399' }
                      : { background: 'rgba(255,255,255,0.05)', color: '#4a6190' }}>
                    ✓
                  </button>
                  <button
                    onClick={() => updateLesson(i, 'status', 'no_show')}
                    className="flex-1 py-1.5 rounded-lg text-[10px] font-bold"
                    style={l.status === 'no_show'
                      ? { background: 'rgba(245,158,11,0.25)', color: '#f59e0b' }
                      : { background: 'rgba(255,255,255,0.05)', color: '#4a6190' }}>
                    ✗
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Liste ekle */}
          <button
            onClick={addBlock}
            className="w-full py-3 text-xs font-bold"
            style={{ background: 'rgba(52,211,153,0.08)', color: '#34d399', borderTop: '1px solid rgba(52,211,153,0.15)' }}>
            + 10 Satır Daha Ekle
          </button>
        </div>

        <button onClick={handleSave} disabled={saving || !pkgId || !pkgAmount}
          className="w-full py-4 rounded-2xl font-bold text-sm disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #a78bfa, #7c3aed)', color: '#fff' }}>
          {saving ? 'Kaydediliyor...' : '✓ Geçmiş Bilgileri Kaydet'}
        </button>
      </div>
    </div>
  )
}
