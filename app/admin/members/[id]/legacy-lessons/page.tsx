'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'

const INPUT = { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)', color: '#c8d6f0' }
const CARD  = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }

type LessonStatus = 'completed' | 'no_show'
type Lesson = { date: string; trainer: string; status: LessonStatus }

const DURATION: Record<number, number> = { 4: 1, 8: 2, 12: 3, 16: 4, 20: 5, 30: 8, 60: 12 }

export default function LegacyLessonsPage() {
  const params   = useParams()
  const memberId = params.id as string
  const router   = useRouter()

  const [member,    setMember]    = useState<any>(null)
  const [trainers,  setTrainers]  = useState<any[]>([])
  const [packages,    setPackages]    = useState<any[]>([])
  const [memberships, setMemberships] = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [toast,     setToast]     = useState('')

  // Paket bilgileri
  const [pkgId,     setPkgId]    = useState('')
  const [pkgType,   setPkgType]  = useState<'weekday'|'general'>('weekday')
  const [pkgAmount, setPkgAmount] = useState('')
  const [pkgMethod, setPkgMethod] = useState<'nakit'|'havale'|'kart'>('nakit')
  const [pkgStart,  setPkgStart] = useState('')

  // Varsayılan eğitmen (üyenin atanmış eğitmeni)
  const [defaultTrainer, setDefaultTrainer] = useState('')

  // Dersler — başlangıçta 10 boş satır (trainer sonradan dolar)
  const [lessons, setLessons] = useState<Lesson[]>(
    () => Array.from({ length: 10 }, () => ({ date: '', trainer: '', status: 'completed' as LessonStatus }))
  )

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 4000) }

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('members').select('name, surname, default_trainer_id').eq('id', memberId).single(),
      supabase.from('trainers').select('id, name, surname').order('name'),
      supabase.from('membership_packages').select('id, lesson_count, weekday_price, general_price, is_family').eq('is_active', true).order('lesson_count'),
      supabase.from('memberships').select('id').eq('member_id', memberId).eq('is_current', true).limit(1).single(),
    ]).then(([{ data: m }, { data: t }, { data: p }, { data: ms }]) => {
      setMember(m)
      setTrainers(t ?? [])
      setPackages(p ?? [])
      setMemberships(ms ? [ms] : [])

      // Varsayılan eğitmeni belirle: üyenin atanmış eğitmeni, yoksa ilk eğitmen
      const defT = m?.default_trainer_id || (t && t.length > 0 ? t[0].id : '')
      setDefaultTrainer(defT)

      // Tüm satırlara varsayılan eğitmeni ata
      if (defT) setLessons(prev => prev.map(l => ({ ...l, trainer: defT })))

      setLoading(false)
    })
  }, [])

  // +10 satır ekle — varsayılan eğitmenle
  const addBlock = () => {
    const newRows: Lesson[] = Array.from({ length: 10 }, () => ({
      date: '', trainer: defaultTrainer, status: 'completed' as LessonStatus
    }))
    setLessons(prev => [...prev, ...newRows])
  }

  const updateLesson = (i: number, field: keyof Lesson, val: string) =>
    setLessons(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l))

  const calcEndDate = () => {
    if (!pkgStart || !pkgId) return ''
    const pkg = packages.find(p => p.id === pkgId)
    if (!pkg) return ''
    const months = DURATION[pkg.lesson_count] ?? 12
    const d = new Date(pkgStart)
    d.setMonth(d.getMonth() + months)
    return d.toISOString().split('T')[0]
  }

  const handleSave = async () => {
    const validLessons = lessons.filter(l => l.date && l.trainer)
    const hasNewPkg = pkgId && pkgAmount && pkgStart
    if (!hasNewPkg && validLessons.length === 0) { showToast('Ders veya paket bilgisi girin'); return }

    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let membershipId: string | null = memberships[0]?.id ?? null

    if (hasNewPkg) {
      const endDate = calcEndDate()
      const { data: newId, error: pkgErr } = await supabase.rpc('create_direct_membership', {
      p_member_id:      memberId,
      p_admin_id:       user.id,
      p_package_id:     pkgId,
      p_request_type:   pkgType,
      p_payment_amount: parseFloat(pkgAmount),
      p_payment_method: pkgMethod,
      p_start_date:     pkgStart,
        p_end_date:       endDate || null,
        p_used_lessons:   0,
      })
      if (pkgErr) { showToast('Paket hatası: ' + pkgErr.message); setSaving(false); return }
      if (!newId)  { showToast('Paket ID alınamadı'); setSaving(false); return }
      membershipId = newId as string
    }

    // Geçerli dersleri ekle
    if (validLessons.length > 0 && membershipId) {
      const lessonsData = validLessons.map(l => ({
        scheduled_date: l.date,
        trainer_id:     l.trainer,
        status:         l.status,
      }))
      const { error: lessonErr } = await supabase.rpc('add_legacy_lessons', {
        p_member_id:     memberId,
        p_admin_id:      user.id,
        p_membership_id: membershipId as string,
        p_lessons:       lessonsData,
      })
      if (lessonErr) { showToast('Ders hatası: ' + lessonErr.message); setSaving(false); return }
    }

    // Üyenin pending_legacy_setup bayrağını kapat
    await supabase.from('members').update({ pending_legacy_setup: false }).eq('id', memberId)

    setSaving(false)
    const msg = validLessons.length > 0
      ? `Paket + ${validLessons.length} ders kaydedildi ✓`
      : 'Paket kaydedildi ✓'
    showToast(msg)
    setTimeout(() => router.push(`/admin/members/${memberId}/settings`), 1500)
  }

  const endDate  = calcEndDate()
  const validCnt = lessons.filter(l => l.date && l.trainer).length

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
          <h2 className="font-bold text-white">Geçmiş Paket & Ders Ekle</h2>
          <p className="text-xs" style={{ color: '#a78bfa' }}>{member?.name} {member?.surname}</p>
        </div>
      </div>

      <div className="px-4 py-5 space-y-4 pb-32">

        {/* PAKET BİLGİLERİ */}
        <div className="rounded-2xl p-4 space-y-3" style={CARD}>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#f59e0b' }}>Paket</p>

          {/* Paket seç */}
          <select value={pkgId} onChange={e => setPkgId(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={INPUT}>
            <option value="">Paket seç...</option>
            {packages.map(p => <option key={p.id} value={p.id}>{p.lesson_count} Ders{p.is_family ? ' (Aile)' : ''}</option>)}
          </select>

          {/* Tip */}
          <div className="flex gap-2">
            {(['weekday','general'] as const).map(t => (
              <button key={t} onClick={() => setPkgType(t)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={pkgType === t ? { background: '#f59e0b', color: '#0a0f2e' } : { background: 'rgba(255,255,255,0.06)', color: '#7b93c4' }}>
                {t === 'weekday' ? 'Hafta İçi' : 'Genel'}
              </button>
            ))}
          </div>

          {/* Tutar */}
          <input type="number" value={pkgAmount} onChange={e => setPkgAmount(e.target.value)}
            placeholder="Ödeme tutarı (₺)"
            className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={INPUT} />

          {/* Ödeme yöntemi */}
          <div className="flex gap-2">
            {(['nakit','havale','kart'] as const).map(m => (
              <button key={m} onClick={() => setPkgMethod(m)}
                className="flex-1 py-2 rounded-xl text-xs font-bold capitalize"
                style={pkgMethod === m ? { background: '#f59e0b', color: '#0a0f2e' } : { background: 'rgba(255,255,255,0.06)', color: '#7b93c4' }}>
                {m}
              </button>
            ))}
          </div>

          {/* Tarih */}
          <div>
            <p className="text-xs mb-1" style={{ color: '#7b93c4' }}>Başlangıç tarihi</p>
            <input type="date" value={pkgStart} onChange={e => setPkgStart(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={INPUT} />
          </div>

          {/* Bitiş — otomatik */}
          {endDate && (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl"
              style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
              <span className="text-xs" style={{ color: '#7b93c4' }}>Bitiş tarihi</span>
              <span className="text-sm font-bold" style={{ color: '#34d399' }}>{endDate}</span>
            </div>
          )}
        </div>

        {/* DERS TABLOSU */}
        <div className="rounded-2xl overflow-hidden" style={CARD}>
          {/* Başlıklar */}
          <div className="grid px-3 py-2"
            style={{ gridTemplateColumns: '130px 1fr 80px', gap: 6, background: 'rgba(167,139,250,0.08)', borderBottom: '1px solid rgba(167,139,250,0.2)' }}>
            <p className="text-[10px] font-bold uppercase" style={{ color: '#a78bfa' }}>Tarih</p>
            <p className="text-[10px] font-bold uppercase" style={{ color: '#a78bfa' }}>Eğitmen</p>
            <p className="text-[10px] font-bold uppercase text-center" style={{ color: '#a78bfa' }}>Durum</p>
          </div>

          {/* Satırlar */}
          {lessons.map((l, i) => (
            <div key={i} className="grid px-3 py-1.5 items-center"
              style={{ gridTemplateColumns: '130px 1fr 80px', gap: 6, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <input type="date" value={l.date}
                onChange={e => updateLesson(i, 'date', e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg text-xs outline-none" style={INPUT} />
              <select value={l.trainer}
                onChange={e => updateLesson(i, 'trainer', e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg text-xs outline-none" style={INPUT}>
                <option value="">Seç</option>
                {trainers.map(t => <option key={t.id} value={t.id}>{t.name} {t.surname}</option>)}
              </select>
              <div className="flex gap-1">
                <button onClick={() => updateLesson(i, 'status', 'completed')}
                  className="flex-1 py-1.5 rounded-lg text-[10px] font-bold"
                  style={l.status === 'completed'
                    ? { background: 'rgba(52,211,153,0.25)', color: '#34d399' }
                    : { background: 'rgba(255,255,255,0.05)', color: '#4a6190' }}>✓</button>
                <button onClick={() => updateLesson(i, 'status', 'no_show')}
                  className="flex-1 py-1.5 rounded-lg text-[10px] font-bold"
                  style={l.status === 'no_show'
                    ? { background: 'rgba(245,158,11,0.25)', color: '#f59e0b' }
                    : { background: 'rgba(255,255,255,0.05)', color: '#4a6190' }}>✗</button>
              </div>
            </div>
          ))}

          {/* +10 satır */}
          <button onClick={addBlock}
            className="w-full py-3 text-xs font-bold"
            style={{ background: 'rgba(52,211,153,0.08)', color: '#34d399', borderTop: '1px solid rgba(52,211,153,0.15)' }}>
            + 10 Satır Daha Ekle
          </button>
        </div>

        {/* Gösterge + Kaydet */}
        {validCnt > 0 && (
          <div className="px-4 py-2 rounded-xl text-xs text-center"
            style={{ background: 'rgba(52,211,153,0.10)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>
            ✓ {validCnt} ders kaydedilecek
          </div>
        )}

        <button onClick={handleSave} disabled={saving || (validCnt === 0 && !(pkgId && pkgAmount && pkgStart))}
          className="w-full py-4 rounded-2xl font-bold text-sm disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #a78bfa, #7c3aed)', color: '#fff' }}>
          {saving ? 'Kaydediliyor...' : validCnt > 0 ? `✓ Paket + ${validCnt} Dersi Kaydet` : '✓ Paketi Kaydet'}
        </button>
      </div>
    </div>
  )
}
