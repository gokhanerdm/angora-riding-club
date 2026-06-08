'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'

const INPUT = { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)', color: '#c8d6f0' }
const CARD  = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }
const OGRETIM = ['İlkokul','Ortaokul','Lise','Ön Lisans','Lisans','Yüksek Lisans','Doktora','Diğer']

export default function AdminMemberProfileEdit() {
  const params   = useParams()
  const memberId = params.id as string
  const router   = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [toast,   setToast]   = useState('')

  const [name,     setName]     = useState('')
  const [surname,  setSurname]  = useState('')
  const [phone,    setPhone]    = useState('')
  const [dogumYeri, setDogumYeri] = useState('')
  const [dogumTarihi, setDogumTarihi] = useState('')
  const [acilTel,  setAcilTel]  = useState('')
  const [babaAdi,  setBabaAdi]  = useState('')
  const [anneAdi,  setAnneAdi]  = useState('')
  const [meslek,   setMeslek]   = useState('')
  const [ogretim,  setOgretim]  = useState('')
  const [adres,    setAdres]    = useState('')
  const [tcKimlik, setTcKimlik] = useState('')
  const [userId,   setUserId]   = useState('')

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('members').select('user_id, name, surname, phone, date_of_birth, dogum_yeri, adres, emergency_contact_phone, meslek, ogretim_durumu, baba_adi, anne_adi').eq('id', memberId).is('deleted_at', null).single(),
      supabase.from('member_sensitive_data').select('tc_kimlik').eq('member_id', memberId).single(),
    ]).then(([{ data: m }, { data: s }]) => {
      if (!m) return
      setUserId(m.user_id ?? '')
      setName(m.name ?? '')
      setSurname(m.surname ?? '')
      setPhone(m.phone ?? '')
      setDogumYeri(m.dogum_yeri ?? '')
      setDogumTarihi(m.date_of_birth ?? '')
      setAcilTel(m.emergency_contact_phone ?? '')
      setBabaAdi(m.baba_adi ?? '')
      setAnneAdi(m.anne_adi ?? '')
      setMeslek(m.meslek ?? '')
      setOgretim(m.ogretim_durumu ?? '')
      setAdres(m.adres ?? '')
      setTcKimlik(s?.tc_kimlik ?? '')
      setLoading(false)
    })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()

    // Temel alanlar
    const { error: e1 } = await supabase.from('members').update({
      name, surname, phone, dogum_yeri: dogumYeri, date_of_birth: dogumTarihi || null,
      emergency_contact_phone: acilTel, baba_adi: babaAdi || null, anne_adi: anneAdi || null,
      meslek: meslek || null, ogretim_durumu: ogretim || null, adres: adres || null,
    }).eq('id', memberId)

    // TC kimlik
    if (tcKimlik) {
      await supabase.from('member_sensitive_data').upsert({ member_id: memberId, tc_kimlik: tcKimlik }, { onConflict: 'member_id' })
    }

    setSaving(false)
    if (e1) showToast('Hata: ' + e1.message)
    else { showToast('Kaydedildi ✓'); setTimeout(() => router.push(`/admin/members/${memberId}/settings`), 1000) }
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
        <h2 className="font-bold text-white">Profil Düzenle</h2>
      </div>

      <div className="px-4 py-5 space-y-4 pb-24">
        <div className="rounded-2xl p-4 space-y-3" style={CARD}>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#f59e0b' }}>Kişisel Bilgiler</p>
          <div className="grid grid-cols-2 gap-3">
            <div><p className="text-xs mb-1" style={{ color: '#7b93c4' }}>Ad</p>
              <input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={INPUT} /></div>
            <div><p className="text-xs mb-1" style={{ color: '#7b93c4' }}>Soyad</p>
              <input value={surname} onChange={e => setSurname(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={INPUT} /></div>
          </div>
          <div><p className="text-xs mb-1" style={{ color: '#7b93c4' }}>Telefon</p>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={INPUT} /></div>
          <div><p className="text-xs mb-1" style={{ color: '#7b93c4' }}>TC Kimlik No</p>
            <input value={tcKimlik} onChange={e => setTcKimlik(e.target.value.replace(/\D/g,''))} maxLength={11}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={INPUT} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><p className="text-xs mb-1" style={{ color: '#7b93c4' }}>Doğum Yeri</p>
              <input value={dogumYeri} onChange={e => setDogumYeri(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={INPUT} /></div>
            <div><p className="text-xs mb-1" style={{ color: '#7b93c4' }}>Doğum Tarihi</p>
              <input type="date" value={dogumTarihi} onChange={e => setDogumTarihi(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={INPUT} /></div>
          </div>
          <div><p className="text-xs mb-1" style={{ color: '#7b93c4' }}>Acil İletişim</p>
            <input type="tel" value={acilTel} onChange={e => setAcilTel(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={INPUT} /></div>
        </div>

        <div className="rounded-2xl p-4 space-y-3" style={CARD}>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#7b93c4' }}>Ek Bilgiler</p>
          <div className="grid grid-cols-2 gap-3">
            <div><p className="text-xs mb-1" style={{ color: '#7b93c4' }}>Baba Adı</p>
              <input value={babaAdi} onChange={e => setBabaAdi(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={INPUT} /></div>
            <div><p className="text-xs mb-1" style={{ color: '#7b93c4' }}>Anne Adı</p>
              <input value={anneAdi} onChange={e => setAnneAdi(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={INPUT} /></div>
          </div>
          <div><p className="text-xs mb-1" style={{ color: '#7b93c4' }}>Meslek</p>
            <input value={meslek} onChange={e => setMeslek(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={INPUT} /></div>
          <div><p className="text-xs mb-1" style={{ color: '#7b93c4' }}>Öğrenim</p>
            <select value={ogretim} onChange={e => setOgretim(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={INPUT}>
              <option value="">Seç...</option>
              {OGRETIM.map(o => <option key={o} value={o}>{o}</option>)}
            </select></div>
          <div><p className="text-xs mb-1" style={{ color: '#7b93c4' }}>Adres</p>
            <textarea value={adres} onChange={e => setAdres(e.target.value)} rows={2}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none" style={INPUT} /></div>
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
