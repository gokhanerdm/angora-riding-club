'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'

const INPUT = { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)', color: '#c8d6f0' }
const SLOTS = ['10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00']

export default function LegacyLessonsPage() {
  const params   = useParams()
  const memberId = params.id as string
  const router   = useRouter()

  const [member,     setMember]     = useState<any>(null)
  const [trainers,   setTrainers]   = useState<any[]>([])
  const [memberships, setMemberships] = useState<any[]>([])
  const [packages,   setPackages]   = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [toast,      setToast]      = useState('')
  const [selectedMs, setSelectedMs] = useState('')

  // Yeni paket oluşturma state
  const [addPkg,     setAddPkg]     = useState(false)
  const [pkgId,      setPkgId]      = useState('')
  const [pkgType,    setPkgType]    = useState<'weekday'|'general'>('weekday')
  const [pkgAmount,  setPkgAmount]  = useState('')
  const [pkgMethod,  setPkgMethod]  = useState<'nakit'|'havale'|'kart'>('nakit')
  const [pkgStart,   setPkgStart]   = useState('')

  type LessonStatus = 'completed' | 'no_show'
  type Lesson = { date: string; trainer: string; status: LessonStatus; slot: string }
  const emptyLesson = (): Lesson => ({ date: '', trainer: '', status: 'completed', slot: '10:30' })
  const [lessons, setLessons] = useState<Lesson[]>(() => Array.from({ length: 10 }, emptyLesson))

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 4000) }

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('members').select('name, surname').eq('id', memberId).single(),
      supabase.from('trainers').select('id, name, surname').is('deleted_at', null),
      supabase.from('memberships').select('id, total_lessons, type, start_date, is_current').eq('member_id', memberId).order('created_at', { ascending: false }),
      supabase.from('membership_packages').select('id, lesson_count, weekday_price, general_price').eq('is_active', true).gt('weekday_price', 0).order('lesson_count'),
    ]).then(([{ data: m }, { data: t }, { data: ms }, { data: p }]) => {
      setMember(m)
      setTrainers(t ?? [])
      setMemberships(ms ?? [])
      setPackages(p ?? [])
      if (ms && ms.length > 0) setSelectedMs(ms.find(x => x.is_current)?.id ?? ms[0].id)
      if (t && t.length > 0) setLessons(prev => prev.map(l => ({ ...l, trainer: l.trainer || t[0].id })))
      setLoading(false)
    })
  }, [])

  const updateLesson = (i: number, field: string, val: string) =>
    setLessons(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l))

  const addBlock = () => setLessons(prev => [...prev, ...Array.from({ length: 10 }, emptyLesson)])

  const handleSave = async () => {
    const validLessons = lessons.filter(l => l.date && l.trainer)
    if (validLessons.length === 0 && !addPkg) { showToast('En az 1 ders tarihi veya yeni paket girin'); return }

    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let membershipId = selectedMs

    // Yeni paket oluştur
    if (addPkg && pkgId && pkgAmount) {
      const { data: newMsId, error: pkgErr } = await supabase.rpc('create_direct_membership', {
        p_member_id: memberId, p_admin_id: user.id, p_package_id: pkgId,
        p_request_type: pkgType, p_payment_amount: parseFloat(pkgAmount),
        p_payment_method: pkgMethod,
        p_start_date: pkgStart || new Date().toISOString().split('T')[0],
      })
      if (pkgErr) { showToast('Paket hatası: ' + pkgErr.message); setSaving(false); return }
      if (!newMsId) { showToast('Paket ID alınamadı'); setSaving(false); return }
      membershipId = newMsId as string
      // Memberships listesini güncelle
      const { data: ms } = await supabase.from('memberships').select('id, total_lessons, type, start_date, is_current').eq('member_id', memberId).order('created_at', { ascending: false })
      setMemberships(ms ?? [])
      setSelectedMs(membershipId)
      showToast('Paket oluşturuldu ✓')
    }

    if (!membershipId) { showToast('Paket seçin veya yeni paket ekleyin'); setSaving(false); return }

    const lessonsData = validLessons.map(l => ({
      scheduled_date: l.date,
      trainer_id: l.trainer,
      status: l.status,
      start_time: l.slot + ':00',
      end_time: (() => {
        const [h, m] = l.slot.split(':').map(Number)
        const t = h * 60 + m + 30
        return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}:00`
      })()
    }))

    const { error } = await supabase.rpc('add_legacy_lessons', {
      p_member_id: memberId,
      p_admin_id: user.id,
      p_membership_id: membershipId,
      p_lessons: lessonsData,
    })

    setSaving(false)
    if (error) { showToast('Hata: ' + error.message); return }

    showToast(`✓ ${validLessons.length} ders eklendi`)
    setTimeout(() => router.push(`/admin/members/${memberId}/settings`), 1500)
  }

  if (loading) return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'linear-gradient(160deg, #0a0f2e, #0d1b4b, #071428)' }}>
      <p style={{ color: '#7b93c4' }}>Yükleniyor...</p>
    </div>
  )

  const validCount = lessons.filter(l => l.date && l.trainer).length

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto"
      style={{ background: 'linear-gradient(160deg, #0a0f2e, #0d1b4b, #071428)' }}>

      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[120] px-5 py-3 rounded-2xl text-sm font-bold text-white whitespace-nowrap"
          style={{ background: toast.includes('✓') ? 'rgba(52,211,153,0.25)' : 'rgba(248,113,113,0.25)', border: '1px solid rgba(255,255,255,0.2)' }}>
          {toast}
        </div>
      )}

      <div className="flex items-center gap-3 px-4 pt-14 pb-4 sticky top-0"
        style={{ background: '#0a0f2e', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <button onClick={() => router.back()} className="font-bold text-sm px-3 py-2 rounded-xl"
          style={{ color: '#7b93c4', background: 'rgba(255,255,255,0.06)' }}>← Geri</button>
        <div>
          <h2 className="font-bold text-white">Geçmiş Ders Ekle</h2>
          <p className="text-xs" style={{ color: '#a78bfa' }}>{member?.name} {member?.surname}</p>
        </div>
      </div>

      <div className="px-4 py-5 space-y-4 pb-32">

        {/* Paket seç veya yeni ekle */}
        <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex justify-between items-center">
            <p className="text-xs font-bold" style={{ color: '#f59e0b' }}>Paket</p>
            <button onClick={() => setAddPkg(p => !p)}
              className="text-xs font-bold px-3 py-1 rounded-xl"
              style={addPkg ? { background: 'rgba(52,211,153,0.15)', color: '#34d399' } : { background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
              {addPkg ? '← Mevcut pakete ekle' : '+ Yeni paket ekle'}
            </button>
          </div>

          {!addPkg ? (
            <select value={selectedMs} onChange={e => setSelectedMs(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={INPUT}>
              {memberships.length === 0
                ? <option value="">Paket yok — yeni paket ekle</option>
                : memberships.map(ms => (
                  <option key={ms.id} value={ms.id}>
                    {ms.total_lessons} Ders · {ms.type === 'weekday' ? 'Hafta İçi' : 'Genel'} · {ms.start_date} {ms.is_current ? '(Aktif)' : ''}
                  </option>
                ))}
            </select>
          ) : (
            <div className="space-y-2">
              <select value={pkgId} onChange={e => setPkgId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={INPUT}>
                <option value="">Paket seç...</option>
                {packages.map(p => <option key={p.id} value={p.id}>{p.lesson_count} Ders</option>)}
              </select>
              <div className="flex gap-2">
                {(['weekday','general'] as const).map(t => (
                  <button key={t} onClick={() => setPkgType(t)} className="flex-1 py-2 rounded-xl text-xs font-bold"
                    style={pkgType === t ? { background: '#f59e0b', color: '#0a0f2e' } : { background: 'rgba(255,255,255,0.06)', color: '#7b93c4' }}>
                    {t === 'weekday' ? 'Hafta İçi' : 'Genel'}
                  </button>
                ))}
              </div>
              <input type="number" value={pkgAmount} onChange={e => setPkgAmount(e.target.value)}
                placeholder="Ödeme tutarı (₺)" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={INPUT} />
              <div className="flex gap-2">
                {(['nakit','havale','kart'] as const).map(m => (
                  <button key={m} onClick={() => setPkgMethod(m)} className="flex-1 py-2 rounded-xl text-xs font-bold capitalize"
                    style={pkgMethod === m ? { background: '#f59e0b', color: '#0a0f2e' } : { background: 'rgba(255,255,255,0.06)', color: '#7b93c4' }}>{m}</button>
                ))}
              </div>
              <input type="date" value={pkgStart} onChange={e => setPkgStart(e.target.value)}
                placeholder="Başlangıç tarihi" className="w-full px-3 py-2.5 rounded-xl text-xs outline-none" style={INPUT} />
            </div>
          )}
        </div>

        {/* Ders tablosu */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="grid px-3 py-2" style={{ gridTemplateColumns: '130px 1fr 90px', gap: 6, background: 'rgba(167,139,250,0.08)', borderBottom: '1px solid rgba(167,139,250,0.2)' }}>
            <p className="text-[10px] font-bold uppercase" style={{ color: '#a78bfa' }}>Tarih</p>
            <p className="text-[10px] font-bold uppercase" style={{ color: '#a78bfa' }}>Eğitmen</p>
            <p className="text-[10px] font-bold uppercase text-center" style={{ color: '#a78bfa' }}>Durum</p>
          </div>
          <div>
            {lessons.map((l, i) => (
              <div key={i} className="grid px-3 py-1.5 items-center" style={{ gridTemplateColumns: '130px 1fr 90px', gap: 6, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <input type="date" value={l.date} onChange={e => updateLesson(i, 'date', e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg text-xs outline-none" style={INPUT} />
                <select value={l.trainer} onChange={e => updateLesson(i, 'trainer', e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg text-xs outline-none" style={INPUT}>
                  <option value="">Seç</option>
                  {trainers.map(t => <option key={t.id} value={t.id}>{t.name} {t.surname}</option>)}
                </select>
                <div className="flex gap-1">
                  <button onClick={() => updateLesson(i, 'status', 'completed')} className="flex-1 py-1.5 rounded-lg text-[10px] font-bold"
                    style={l.status === 'completed' ? { background: 'rgba(52,211,153,0.25)', color: '#34d399' } : { background: 'rgba(255,255,255,0.05)', color: '#4a6190' }}>✓</button>
                  <button onClick={() => updateLesson(i, 'status', 'no_show')} className="flex-1 py-1.5 rounded-lg text-[10px] font-bold"
                    style={l.status === 'no_show' ? { background: 'rgba(245,158,11,0.25)', color: '#f59e0b' } : { background: 'rgba(255,255,255,0.05)', color: '#4a6190' }}>✗</button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={addBlock} className="w-full py-3 text-xs font-bold"
            style={{ background: 'rgba(52,211,153,0.08)', color: '#34d399', borderTop: '1px solid rgba(52,211,153,0.15)' }}>
            + 10 Satır Daha Ekle
          </button>
        </div>

        {/* Gösterge */}
        {lessons.filter(l => l.date).length > 0 && (
          <div className="px-4 py-2 rounded-xl text-xs text-center"
            style={{ background: validCount > 0 ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)', color: validCount > 0 ? '#34d399' : '#f87171' }}>
            {validCount > 0 ? `✓ ${validCount} ders kaydedilecek` : '⚠️ Eğitmen seçili değil'}
          </div>
        )}

        <button onClick={handleSave} disabled={saving || validCount === 0 || !selectedMs}
          className="w-full py-4 rounded-2xl font-bold text-sm disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #a78bfa, #7c3aed)', color: '#fff' }}>
          {saving ? 'Kaydediliyor...' : `✓ ${validCount} Dersi Kaydet`}
        </button>
      </div>
    </div>
  )
}
