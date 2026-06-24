'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import AdminBottomNav from '@/components/admin/AdminBottomNav'

const CARD = { background: 'rgba(27,59,47,0.05)', border: '1px solid rgba(27,59,47,0.10)' }
const INPUT = { background: 'rgba(27,59,47,0.04)', border: '1px solid rgba(27,59,47,0.15)', color: '#1B3B2F' }
const SLOTS = ['10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00']

export default function NewPassiveMemberPage() {
  const router = useRouter()
  const [step, setStep] = useState<1|2|3>(1)

  // Step 1 — Kişi bilgileri
  const [name, setName]       = useState('')
  const [surname, setSurname] = useState('')
  const [phone, setPhone]     = useState('')
  const [email, setEmail]     = useState('')

  // Step 2 — Paket bilgileri
  const [packages, setPackages]   = useState<any[]>([])
  const [trainers, setTrainers]   = useState<any[]>([])
  const [pkgId, setPkgId]         = useState('')
  const [pkgType, setPkgType]     = useState<'weekday'|'general'>('weekday')
  const [pkgAmount, setPkgAmount] = useState('')
  const [pkgMethod, setPkgMethod] = useState<'nakit'|'havale'|'kart'>('nakit')
  const [pkgStartDate, setPkgStartDate] = useState('')
  const [pkgEndDate, setPkgEndDate]     = useState('')

  // Step 3 — Ders girişi
  const [lessons, setLessons] = useState<{date:string; trainer:string; status:'completed'|'no_show'; slot:string}[]>([
    { date: '', trainer: '', status: 'completed', slot: '10:30' }
  ])

  const [saving, setSaving] = useState(false)
  const [toast, setToast]   = useState('')
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('membership_packages').select('id,lesson_count,weekday_price,general_price').eq('is_active',true).gt('weekday_price',0).order('lesson_count'),
      supabase.from('trainers').select('id,name,surname').is('deleted_at',null),
    ]).then(([{data:p},{data:t}]) => { setPackages(p??[]); setTrainers(t??[]) })
  }, [])

  const addLesson = () => setLessons(prev => [...prev, { date:'', trainer: trainers[0]?.id ?? '', status:'completed', slot:'10:30' }])
  const removeLesson = (i: number) => setLessons(prev => prev.filter((_,idx) => idx !== i))
  const updateLesson = (i: number, field: string, val: string) => setLessons(prev => prev.map((l,idx) => idx===i ? {...l,[field]:val} : l))

  const handleSave = async () => {
    if (!name || !surname) { showToast('Ad ve soyad zorunlu'); return }
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Pasif üye oluştur
    const { data: memberId, error: e1 } = await supabase.rpc('create_passive_member', {
      p_admin_id: user.id, p_name: name, p_surname: surname, p_phone: phone, p_email: email || null
    })
    if (e1) { showToast('Hata: ' + e1.message); setSaving(false); return }

    // Paket varsa oluştur
    let membershipId: string | null = null
    if (pkgId && pkgAmount) {
      const { data: createdMsId, error: e2 } = await supabase.rpc('create_direct_membership', {
        p_member_id: memberId, p_admin_id: user.id, p_package_id: pkgId,
        p_request_type: pkgType, p_payment_amount: parseFloat(pkgAmount),
        p_payment_method: pkgMethod, p_start_date: pkgStartDate || new Date().toISOString().split('T')[0]
      })
      if (e2) { showToast('Paket hatası: ' + e2.message); setSaving(false); return }
      membershipId = createdMsId as string
    }

    // Dersler varsa ekle
    const validLessons = lessons.filter(l => l.date && l.trainer)
    if (validLessons.length > 0 && membershipId) {
      const lessonsData = validLessons.map(l => ({
        scheduled_date: l.date,
        trainer_id: l.trainer,
        status: l.status,
        start_time: l.slot + ':00',
        end_time: (() => { const [h,m]=l.slot.split(':').map(Number); const t=h*60+m+30; return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}:00` })()
      }))
      const { error: e3 } = await supabase.rpc('add_legacy_lessons', {
        p_member_id: memberId, p_admin_id: user.id, p_membership_id: membershipId,
        p_lessons: lessonsData,
      })
      if (e3) showToast('Ders ekleme hatası: ' + e3.message)
    }

    setSaving(false)
    router.push('/admin/members')
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto"
      style={{ background: '#FBFBFB' }}>

      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[120] px-5 py-3 rounded-2xl text-sm font-bold whitespace-nowrap"
          style={{ background: 'rgba(248,113,113,0.25)', border: '1px solid rgba(248,113,113,0.4)' }}>
          {toast}
        </div>
      )}

      <div className="flex items-center gap-3 px-4 pt-14 pb-4 sticky top-0"
        style={{ background: '#FBFBFB', borderBottom: '1px solid rgba(27,59,47,0.10)' }}>
        <button onClick={() => router.back()} className="font-bold text-sm px-3 py-2 rounded-xl"
          style={{ color: 'rgba(27,59,47,0.55)', background: 'rgba(27,59,47,0.06)' }}>← Geri</button>
        <div>
          <h2 className="font-bold">Pasif Üye Ekle</h2>
          <p className="text-xs" style={{ color: 'rgba(27,59,47,0.55)' }}>Adım {step}/3</p>
        </div>
      </div>

      <div className="px-4 py-6 space-y-4 pb-32">

        {/* Step 1 */}
        <div className="rounded-2xl p-4 space-y-3" style={CARD}>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#f59e0b' }}>Kişi Bilgileri</p>
          <div className="grid grid-cols-2 gap-3">
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ad *" className="px-3 py-2.5 rounded-xl text-sm outline-none" style={INPUT} />
            <input value={surname} onChange={e=>setSurname(e.target.value)} placeholder="Soyad *" className="px-3 py-2.5 rounded-xl text-sm outline-none" style={INPUT} />
          </div>
          <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Telefon" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={INPUT} />
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email (isteğe bağlı)" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={INPUT} />
        </div>

        {/* Step 2 — Paket */}
        <div className="rounded-2xl p-4 space-y-3" style={CARD}>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#f59e0b' }}>Paket Bilgileri (isteğe bağlı)</p>
          <select value={pkgId} onChange={e=>setPkgId(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={INPUT}>
            <option value="">Paket yok</option>
            {packages.map(p => <option key={p.id} value={p.id}>{p.lesson_count} Ders</option>)}
          </select>
          {pkgId && <>
            <div className="flex gap-2">
              {(['weekday','general'] as const).map(t => (
                <button key={t} onClick={()=>setPkgType(t)} className="flex-1 py-2 rounded-xl text-xs font-bold"
                  style={pkgType===t?{background:'#f59e0b',color:'#0a0f2e'}:{background:'rgba(27,59,47,0.06)',color:'rgba(27,59,47,0.55)'}}>
                  {t==='weekday'?'Hafta İçi':'Genel'}
                </button>
              ))}
            </div>
            <input type="number" value={pkgAmount} onChange={e=>setPkgAmount(e.target.value)} placeholder="Ödeme tutarı (₺)" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={INPUT} />
            <div className="flex gap-2">
              {(['nakit','havale','kart'] as const).map(m=>(
                <button key={m} onClick={()=>setPkgMethod(m)} className="flex-1 py-2 rounded-xl text-xs font-bold capitalize"
                  style={pkgMethod===m?{background:'#f59e0b',color:'#0a0f2e'}:{background:'rgba(27,59,47,0.06)',color:'rgba(27,59,47,0.55)'}}>{m}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={pkgStartDate} onChange={e=>setPkgStartDate(e.target.value)} className="px-3 py-2.5 rounded-xl text-xs outline-none" style={INPUT} />
              <input type="date" value={pkgEndDate} onChange={e=>setPkgEndDate(e.target.value)} className="px-3 py-2.5 rounded-xl text-xs outline-none" style={INPUT} />
            </div>
          </>}
        </div>

        {/* Step 3 — Dersler */}
        {pkgId && (
          <div className="rounded-2xl p-4 space-y-3" style={CARD}>
            <div className="flex justify-between items-center">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#f59e0b' }}>Geçmiş Dersler</p>
              <button onClick={addLesson} className="text-xs font-bold px-3 py-1.5 rounded-xl" style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399' }}>+ Ders Ekle</button>
            </div>
            {lessons.map((l,i) => (
              <div key={i} className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex justify-between items-center">
                  <p className="text-xs font-bold" style={{ color: 'rgba(27,59,47,0.55)' }}>Ders {i+1}</p>
                  {lessons.length > 1 && <button onClick={() => removeLesson(i)} className="text-xs" style={{ color: '#f87171' }}>Sil</button>}
                </div>
                <input type="date" value={l.date} onChange={e=>updateLesson(i,'date',e.target.value)} className="w-full px-3 py-2 rounded-xl text-xs outline-none" style={INPUT} />
                <select value={l.trainer} onChange={e=>updateLesson(i,'trainer',e.target.value)} className="w-full px-3 py-2 rounded-xl text-xs outline-none" style={INPUT}>
                  <option value="">Eğitmen seç</option>
                  {trainers.map(t=><option key={t.id} value={t.id}>{t.name} {t.surname}</option>)}
                </select>
                <div className="flex gap-2">
                  <select value={l.slot} onChange={e=>updateLesson(i,'slot',e.target.value)} className="flex-1 px-3 py-2 rounded-xl text-xs outline-none" style={INPUT}>
                    {SLOTS.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={()=>updateLesson(i,'status','completed')} className="flex-1 py-2 rounded-xl text-xs font-bold"
                    style={l.status==='completed'?{background:'rgba(52,211,153,0.2)',color:'#34d399'}:{background:'rgba(27,59,47,0.05)',color:'rgba(27,59,47,0.55)'}}>Yapıldı</button>
                  <button onClick={()=>updateLesson(i,'status','no_show')} className="flex-1 py-2 rounded-xl text-xs font-bold"
                    style={l.status==='no_show'?{background:'rgba(245,158,11,0.2)',color:'#f59e0b'}:{background:'rgba(27,59,47,0.05)',color:'rgba(27,59,47,0.55)'}}>Gelmedi</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button onClick={handleSave} disabled={saving || !name || !surname}
          className="w-full py-4 rounded-2xl font-bold disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#0a0f2e' }}>
          {saving ? 'Kaydediliyor...' : 'Pasif Üye Kaydet'}
        </button>
      </div>
      <AdminBottomNav />
    </div>
  )
}
