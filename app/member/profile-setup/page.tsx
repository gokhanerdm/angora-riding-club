'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const CARD  = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }
const INPUT = { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)', color: '#c8d6f0' }

const OGRETIM = ['İlkokul', 'Ortaokul', 'Lise', 'Ön Lisans', 'Lisans', 'Yüksek Lisans', 'Doktora', 'Diğer']

export default function ProfileSetupPage() {
  const [tcKimlik, setTcKimlik]           = useState('')
  const [dogumYeri, setDogumYeri]         = useState('')
  const [dogumTarihi, setDogumTarihi]     = useState('')
  const [acilTelefon, setAcilTelefon]     = useState('')
  const [babaAdi, setBabaAdi]             = useState('')
  const [anneAdi, setAnneAdi]             = useState('')
  const [meslek, setMeslek]               = useState('')
  const [ogretimDurumu, setOgretimDurumu] = useState('')
  const [adres, setAdres]                 = useState('')
  const [photo, setPhoto]                 = useState<File | null>(null)
  const [photoPreview, setPhotoPreview]   = useState<string | null>(null)
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState('')
  const router = useRouter()

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tcKimlik || !dogumYeri || !dogumTarihi || !acilTelefon) {
      setError('Lütfen zorunlu alanları doldurun.')
      return
    }
    if (tcKimlik.length !== 11 || !/^\d+$/.test(tcKimlik)) {
      setError('TC Kimlik No 11 haneli rakamlardan oluşmalıdır.')
      return
    }

    setSaving(true)
    setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let photoUrl: string | null = null

    // Fotoğraf yükle
    if (photo) {
      const ext = photo.name.split('.').pop()
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('member-photos')
        .upload(`${user.id}/profile.${ext}`, photo, { upsert: true })
      if (!uploadErr && uploadData) {
        const { data: urlData } = supabase.storage
          .from('member-photos')
          .getPublicUrl(uploadData.path)
        photoUrl = urlData.publicUrl
      }
    }

    const { error: rpcErr } = await supabase.rpc('update_member_profile', {
      p_user_id:         user.id,
      p_tc_kimlik:       tcKimlik,
      p_dogum_yeri:      dogumYeri,
      p_date_of_birth:   dogumTarihi,
      p_emergency_phone: acilTelefon,
      p_baba_adi:        babaAdi || null,
      p_anne_adi:        anneAdi || null,
      p_meslek:          meslek || null,
      p_ogretim_durumu:  ogretimDurumu || null,
      p_adres:           adres || null,
      p_photo_url:       photoUrl,
    })

    setSaving(false)
    if (rpcErr) setError('Kaydedilemedi: ' + rpcErr.message)
    else router.push('/member')
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: 'linear-gradient(160deg, #0a0f2e, #0d1b4b, #071428)' }}
    >
      <div className="px-5 pt-12 pb-3">
        <h1 className="text-2xl font-bold text-white">Profil Bilgileri</h1>
        <p className="text-xs mt-1" style={{ color: '#7b93c4' }}>
          Üyeliğinizi tamamlamak için bilgilerinizi doldurun.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="px-5 pb-16 space-y-5">

        {/* Fotoğraf */}
        <div className="flex flex-col items-center py-4">
          <label className="cursor-pointer flex flex-col items-center gap-3">
            <div
              className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(245,158,11,0.4)' }}
            >
              {photoPreview
                ? <img src={photoPreview} alt="Profil" className="w-full h-full object-cover" />
                : <span className="text-4xl">📷</span>
              }
            </div>
            <span className="text-xs font-bold" style={{ color: '#f59e0b' }}>
              {photoPreview ? 'Fotoğrafı Değiştir' : 'Fotoğraf Ekle'}
            </span>
            <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          </label>
        </div>

        {/* Zorunlu bilgiler */}
        <div className="rounded-2xl p-4 space-y-4" style={CARD}>
            <div className="flex items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#f59e0b' }}>
              Zorunlu Bilgiler
            </p>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>
              * zorunlu alanlar
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold mb-2" style={{ color: '#7b93c4' }}>
              TC Kimlik No <span style={{ color: '#f87171' }}>*</span>
            </label>
            <input
              type="text" inputMode="numeric" maxLength={11}
              value={tcKimlik} onChange={e => setTcKimlik(e.target.value.replace(/\D/g, ''))}
              placeholder="11 haneli TC kimlik no"
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={INPUT}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold mb-2" style={{ color: '#7b93c4' }}>
                Doğum Yeri <span style={{ color: '#f87171' }}>*</span>
              </label>
              <input type="text" value={dogumYeri} onChange={e => setDogumYeri(e.target.value)}
                placeholder="Şehir"
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-bold mb-2" style={{ color: '#7b93c4' }}>
                Doğum Tarihi <span style={{ color: '#f87171' }}>*</span>
              </label>
              <input type="date" value={dogumTarihi} onChange={e => setDogumTarihi(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={INPUT} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-2" style={{ color: '#7b93c4' }}>
              Acil Durumlarda Aranacak Numara <span style={{ color: '#f87171' }}>*</span>
            </label>
            <input type="tel" value={acilTelefon} onChange={e => setAcilTelefon(e.target.value)}
              placeholder="05xx xxx xx xx"
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={INPUT} />
          </div>
        </div>

        {/* İsteğe bağlı bilgiler */}
        <div className="rounded-2xl p-4 space-y-4" style={CARD}>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#7b93c4' }}>
            İsteğe Bağlı Bilgiler
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold mb-2" style={{ color: '#7b93c4' }}>Baba Adı</label>
              <input type="text" value={babaAdi} onChange={e => setBabaAdi(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-bold mb-2" style={{ color: '#7b93c4' }}>Anne Adı</label>
              <input type="text" value={anneAdi} onChange={e => setAnneAdi(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={INPUT} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-2" style={{ color: '#7b93c4' }}>Meslek</label>
            <input type="text" value={meslek} onChange={e => setMeslek(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={INPUT} />
          </div>

          <div>
            <label className="block text-xs font-bold mb-2" style={{ color: '#7b93c4' }}>Öğrenim Durumu</label>
            <select value={ogretimDurumu} onChange={e => setOgretimDurumu(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={INPUT}>
              <option value="">Seçin...</option>
              {OGRETIM.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold mb-2" style={{ color: '#7b93c4' }}>İş / Ev Adresi</label>
            <textarea value={adres} onChange={e => setAdres(e.target.value)} rows={2}
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none resize-none" style={INPUT} />
          </div>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-2xl text-sm"
            style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={saving}
          className="w-full py-3.5 rounded-2xl font-bold text-sm disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#0a0f2e' }}>
          {saving ? 'Kaydediliyor...' : 'Kaydet ve Devam Et'}
        </button>
      </form>
    </div>
  )
}
