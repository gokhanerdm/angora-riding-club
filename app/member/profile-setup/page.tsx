'use client'

import { useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

const CARD  = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }
const INPUT = { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)', color: '#c8d6f0' }

const OGRETIM  = ['İlkokul', 'Ortaokul', 'Lise', 'Ön Lisans', 'Lisans', 'Yüksek Lisans', 'Doktora', 'Diğer']
const VELİ_REL = ['Anne', 'Baba', 'Vasi', 'Diğer']

function calculateAge(dateStr: string): number {
  if (!dateStr) return 99
  const today = new Date()
  const dob   = new Date(dateStr)
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
  return age
}

function ProfileSetupForm() {
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
  // Veli
  const [veliAdi, setVeliAdi]             = useState('')
  const [veliTelefon, setVeliTelefon]     = useState('')
  const [veliIliskisi, setVeliIliskisi]   = useState('')
  const [veliTcKimlik, setVeliTcKimlik]   = useState('')
  const [veliOnay, setVeliOnay]           = useState(false)

  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const action    = searchParams.get('action')
  const packageId = searchParams.get('package_id')
  const reqType   = searchParams.get('type')

  const isMinor = calculateAge(dogumTarihi) <= 18

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

    if (isMinor && (!veliAdi || !veliTelefon || !veliIliskisi || !veliTcKimlik)) {
      setError('18 yaş ve altı üyeler için veli bilgileri zorunludur.')
      return
    }
    if (isMinor && !veliOnay) {
      setError('Devam etmek için veli onayını işaretleyin.')
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
      p_veli_adi_soyadi: isMinor ? veliAdi : null,
      p_veli_telefon:    isMinor ? veliTelefon : null,
      p_veli_iliskisi:   isMinor ? veliIliskisi : null,
      p_veli_tc_kimlik:  isMinor ? veliTcKimlik : null,
    })

    if (rpcErr) {
      setSaving(false)
      if (rpcErr.message.includes('TC kimlik numarasıyla kayıtlı')) {
        setError('Bu TC kimlik numarasıyla kayıtlı bir hesap zaten mevcut.')
      } else {
        setError('Kaydedilemedi: ' + rpcErr.message)
      }
      return
    }

    // Profil tamamlandı — paketler sayfasından gelen bekleyen işlemi uygula
    if (action === 'legacy') {
      await supabase.rpc('request_legacy_setup', { p_user_id: user.id })
      router.push('/member/packages')
    } else if (action === 'family') {
      await supabase.rpc('request_family_setup', { p_user_id: user.id })
      router.push('/member/packages')
    } else if (action === 'package' && packageId && reqType) {
      await supabase.rpc('create_membership_request', {
        user_id: user.id,
        p_package_id: packageId,
        p_request_type: reqType,
      })
      router.push('/member/packages?submitted=1')
    } else {
      router.push('/member')
    }
    setSaving(false)
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

        {/* 18 yaş ve altı — veli bilgileri */}
        {isMinor && dogumTarihi && (
          <div
            className="rounded-2xl p-4 space-y-4"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: '#f59e0b' }}>
                Veli Bilgileri
              </p>
              <p className="text-xs" style={{ color: '#7b93c4' }}>
                18 yaş ve altı üyeler için veli onayı zorunludur.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold mb-2" style={{ color: '#7b93c4' }}>
                Veli Adı Soyadı <span style={{ color: '#f87171' }}>*</span>
              </label>
              <input type="text" value={veliAdi} onChange={e => setVeliAdi(e.target.value)}
                placeholder="Anne veya babanın adı soyadı"
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={INPUT} />
            </div>

            <div>
              <label className="block text-xs font-bold mb-2" style={{ color: '#7b93c4' }}>
                Veli TC Kimlik No <span style={{ color: '#f87171' }}>*</span>
              </label>
              <input type="text" inputMode="numeric" maxLength={11}
                value={veliTcKimlik} onChange={e => setVeliTcKimlik(e.target.value.replace(/\D/g, ''))}
                placeholder="11 haneli TC kimlik no"
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={INPUT} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-2" style={{ color: '#7b93c4' }}>
                  Veli Telefonu <span style={{ color: '#f87171' }}>*</span>
                </label>
                <input type="tel" value={veliTelefon} onChange={e => setVeliTelefon(e.target.value)}
                  placeholder="05xx xxx xx xx"
                  className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={INPUT} />
              </div>
              <div>
                <label className="block text-xs font-bold mb-2" style={{ color: '#7b93c4' }}>
                  Yakınlığı <span style={{ color: '#f87171' }}>*</span>
                </label>
                <select value={veliIliskisi} onChange={e => setVeliIliskisi(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={INPUT}>
                  <option value="">Seçin...</option>
                  {VELİ_REL.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={veliOnay}
                onChange={e => setVeliOnay(e.target.checked)}
                className="mt-0.5 w-4 h-4 flex-shrink-0 accent-amber-400"
              />
              <span className="text-xs leading-relaxed font-bold" style={{ color: '#f59e0b' }}>
                Velinin bilgi ve onayı ile kayıt yapıyorum. <span style={{ color: '#f87171' }}>*</span>
              </span>
            </label>
          </div>
        )}

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

export default function ProfileSetupPage() {
  return (
    <Suspense fallback={null}>
      <ProfileSetupForm />
    </Suspense>
  )
}
