'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const INPUT = { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)', color: '#c8d6f0' }
const CARD  = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }
const OGRETIM = ['İlkokul','Ortaokul','Lise','Ön Lisans','Lisans','Yüksek Lisans','Doktora','Diğer']

export default function ProfileEditPage() {
  const router = useRouter()
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
  const [photo,    setPhoto]    = useState<File|null>(null)
  const [photoPreview, setPhotoPreview] = useState<string|null>(null)
  const [memberId, setMemberId] = useState('')

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('members').select(
        'id, name, surname, phone, date_of_birth, dogum_yeri, adres, emergency_contact_phone, meslek, ogretim_durumu, baba_adi, anne_adi, profile_photo_url'
      ).eq('user_id', user.id).single().then(({ data }) => {
        if (!data) return
        setMemberId(data.id)
        setName(data.name ?? '')
        setSurname(data.surname ?? '')
        setPhone(data.phone ?? '')
        setDogumYeri(data.dogum_yeri ?? '')
        setDogumTarihi(data.date_of_birth ?? '')
        setAcilTel(data.emergency_contact_phone ?? '')
        setBabaAdi(data.baba_adi ?? '')
        setAnneAdi(data.anne_adi ?? '')
        setMeslek(data.meslek ?? '')
        setOgretim(data.ogretim_durumu ?? '')
        setAdres(data.adres ?? '')
        setPhotoPreview(data.profile_photo_url ?? null)
        setLoading(false)
      })
    })
  }, [])

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setPhoto(f)
    setPhotoPreview(URL.createObjectURL(f))
  }

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // İsim/soyad/telefon doğrudan güncelle
    await supabase.from('members').update({ name, surname, phone }).eq('id', memberId)

    // Fotoğraf yükle
    let photoUrl: string | null = null
    if (photo) {
      const ext = photo.name.split('.').pop()
      const { data: up } = await supabase.storage.from('member-photos').upload(`${user.id}/profile.${ext}`, photo, { upsert: true })
      if (up) photoUrl = supabase.storage.from('member-photos').getPublicUrl(up.path).data.publicUrl
    }

    const { error } = await supabase.rpc('update_member_profile', {
      p_user_id:         user.id,
      p_tc_kimlik:       '', // TC değiştirilmiyor
      p_dogum_yeri:      dogumYeri,
      p_date_of_birth:   dogumTarihi || null,
      p_emergency_phone: acilTel,
      p_baba_adi:        babaAdi || null,
      p_anne_adi:        anneAdi || null,
      p_meslek:          meslek || null,
      p_ogretim_durumu:  ogretim || null,
      p_adres:           adres || null,
      p_photo_url:       photoUrl,
    })

    setSaving(false)
    if (error) showToast('Hata: ' + error.message)
    else { showToast('Kaydedildi ✓'); setTimeout(() => router.push('/member'), 1000) }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(160deg, #0a0f2e, #0d1b4b, #071428)' }}>
      <p style={{ color: '#7b93c4' }}>Yükleniyor...</p>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #0a0f2e, #0d1b4b, #071428)' }}>
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-bold text-white whitespace-nowrap"
          style={{ background: toast.includes('✓') ? 'rgba(52,211,153,0.25)' : 'rgba(248,113,113,0.25)', border: '1px solid rgba(255,255,255,0.2)' }}>
          {toast}
        </div>
      )}

      <div className="flex items-center gap-3 px-5 pt-12 pb-4">
        <button onClick={() => router.back()} className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-bold"
          style={{ background: 'rgba(255,255,255,0.06)', color: '#7b93c4', border: '1px solid rgba(255,255,255,0.08)' }}>←</button>
        <h1 className="text-xl font-bold text-white">Profili Düzenle</h1>
      </div>

      <div className="px-5 pb-16 space-y-5">
        {/* Fotoğraf */}
        <div className="flex flex-col items-center py-3">
          <label className="cursor-pointer flex flex-col items-center gap-2">
            <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(245,158,11,0.4)' }}>
              {photoPreview ? <img src={photoPreview} alt="" className="w-full h-full object-cover" /> : <span className="text-3xl">🏇</span>}
            </div>
            <span className="text-xs font-bold" style={{ color: '#f59e0b' }}>Fotoğraf Değiştir</span>
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </label>
        </div>

        {/* Temel bilgiler */}
        <div className="rounded-2xl p-4 space-y-3" style={CARD}>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#f59e0b' }}>Kişisel Bilgiler</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs mb-1" style={{ color: '#7b93c4' }}>Ad</p>
              <input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={INPUT} />
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: '#7b93c4' }}>Soyad</p>
              <input value={surname} onChange={e => setSurname(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={INPUT} />
            </div>
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: '#7b93c4' }}>Telefon</p>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={INPUT} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs mb-1" style={{ color: '#7b93c4' }}>Doğum Yeri</p>
              <input value={dogumYeri} onChange={e => setDogumYeri(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={INPUT} />
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: '#7b93c4' }}>Doğum Tarihi</p>
              <input type="date" value={dogumTarihi} onChange={e => setDogumTarihi(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={INPUT} />
            </div>
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: '#7b93c4' }}>Acil İletişim</p>
            <input type="tel" value={acilTel} onChange={e => setAcilTel(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={INPUT} />
          </div>
        </div>

        {/* Ek bilgiler */}
        <div className="rounded-2xl p-4 space-y-3" style={CARD}>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#7b93c4' }}>Ek Bilgiler</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs mb-1" style={{ color: '#7b93c4' }}>Baba Adı</p>
              <input value={babaAdi} onChange={e => setBabaAdi(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={INPUT} />
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: '#7b93c4' }}>Anne Adı</p>
              <input value={anneAdi} onChange={e => setAnneAdi(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={INPUT} />
            </div>
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: '#7b93c4' }}>Meslek</p>
            <input value={meslek} onChange={e => setMeslek(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={INPUT} />
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: '#7b93c4' }}>Öğrenim Durumu</p>
            <select value={ogretim} onChange={e => setOgretim(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={INPUT}>
              <option value="">Seç...</option>
              {OGRETIM.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: '#7b93c4' }}>Adres</p>
            <textarea value={adres} onChange={e => setAdres(e.target.value)} rows={2}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none" style={INPUT} />
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
