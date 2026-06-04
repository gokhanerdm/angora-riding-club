'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'

const INPUT = { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)', color: '#c8d6f0' }
const SHIFT_OPTIONS = [
  { value: 'morning', label: 'Sabah (10:30–20:00)' },
  { value: 'evening', label: 'Akşam (14:00–21:30)' },
  { value: 'fullday', label: 'Tam Gün' },
  { value: 'weekend', label: 'Hafta Sonu (Cmt-Paz)' },
]

export default function TrainerProfileEditPage() {
  const params    = useParams()
  const trainerId = params.id as string
  const router    = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [toast,   setToast]   = useState('')

  const [name,      setName]      = useState('')
  const [surname,   setSurname]   = useState('')
  const [bonusRate, setBonusRate] = useState('0')
  const [shift,     setShift]     = useState('fullday')

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    const supabase = createClient()
    supabase.from('trainers').select('name, surname, bonus_rate, shift').eq('id', trainerId).single()
      .then(({ data }) => {
        if (!data) return
        setName(data.name ?? '')
        setSurname(data.surname ?? '')
        setBonusRate(String(data.bonus_rate ?? 0))
        setShift(data.shift ?? 'fullday')
        setLoading(false)
      })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('trainers').update({
      name, surname, bonus_rate: parseFloat(bonusRate) || 0, shift
    }).eq('id', trainerId)
    setSaving(false)
    if (error) showToast('Hata: ' + error.message)
    else { showToast('Kaydedildi ✓'); setTimeout(() => router.back(), 1000) }
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

      <div className="flex items-center gap-3 px-4 pt-14 pb-4 sticky top-0"
        style={{ background: '#0a0f2e', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <button onClick={() => router.back()} className="font-bold text-sm px-3 py-2 rounded-xl"
          style={{ color: '#7b93c4', background: 'rgba(255,255,255,0.06)' }}>← Geri</button>
        <h2 className="font-bold text-white">Eğitmen Profili Düzenle</h2>
      </div>

      <div className="px-4 py-5 space-y-4 pb-20">
        <div className="rounded-2xl p-4 space-y-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="grid grid-cols-2 gap-3">
            <div><p className="text-xs mb-1 font-bold" style={{ color: '#7b93c4' }}>Ad</p>
              <input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={INPUT} /></div>
            <div><p className="text-xs mb-1 font-bold" style={{ color: '#7b93c4' }}>Soyad</p>
              <input value={surname} onChange={e => setSurname(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={INPUT} /></div>
          </div>

          <div><p className="text-xs mb-1 font-bold" style={{ color: '#7b93c4' }}>Prim Oranı (%)</p>
            <input type="number" min="0" max="100" value={bonusRate} onChange={e => setBonusRate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={INPUT} /></div>

          <div>
            <p className="text-xs mb-2 font-bold" style={{ color: '#7b93c4' }}>Vardiya</p>
            <div className="space-y-2">
              {SHIFT_OPTIONS.map(s => (
                <button key={s.value} onClick={() => setShift(s.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-sm font-bold text-left"
                  style={shift === s.value
                    ? { background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b' }
                    : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#c8d6f0' }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full py-4 rounded-2xl font-bold text-sm disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#0a0f2e' }}>
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </div>
    </div>
  )
}
