'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Package {
  id: string
  lesson_count: number
  weekday_price: number
  general_price: number
}

interface Selection {
  pkg: Package
  type: 'weekday' | 'general'
}

const DURATION: Record<number, string> = {
  8:  '2 Aylık Tesis Üyeliği',
  12: '3 Aylık Tesis Üyeliği',
  20: '5 Aylık Tesis Üyeliği',
  30: '8 Aylık Tesis Üyeliği',
  60: '12 Aylık Tesis Üyeliği',
}

function formatPrice(p: number) {
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0 }).format(p) + ' ₺'
}

const CARD  = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }
const AMBER = { accent: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)' }
const ORANGE= { accent: '#f97316', bg: 'rgba(249,115,22,0.12)',  border: '1px solid rgba(249,115,22,0.3)' }

export default function PackagesPage() {
  const [packages, setPackages]     = useState<Package[]>([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState<Selection | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)
  const [legacyDone, setLegacyDone] = useState(false)
  const [error, setError]           = useState('')
  const router = useRouter()

  useEffect(() => { loadPackages() }, [])

  const loadPackages = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('membership_packages')
      .select('id, lesson_count, weekday_price, general_price')
      .eq('is_active', true)
      .gt('weekday_price', 0)
      .order('lesson_count', { ascending: true })
    if (data) setPackages(data)
    setLoading(false)
  }

  const handleRequest = async () => {
    if (!selected) return
    setSubmitting(true)
    setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSubmitting(false); return }

    const { error: rpcError } = await supabase.rpc('create_membership_request', {
      user_id: user.id,
      p_package_id: selected.pkg.id,
      p_request_type: selected.type,
    })
    setSubmitting(false)
    if (rpcError) setError(rpcError.message)
    else { setSelected(null); setSubmitted(true) }
  }

  const price = (s: Selection) =>
    s.type === 'weekday' ? s.pkg.weekday_price : s.pkg.general_price

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #0a0f2e, #0d1b4b, #071428)' }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-12 pb-6">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-bold flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.06)', color: '#7b93c4', border: '1px solid rgba(255,255,255,0.08)' }}
        >←</button>
        <div>
          <h1 className="text-xl font-bold text-white">Üyelik Seçenekleri</h1>
          <p className="text-xs mt-0.5" style={{ color: '#7b93c4' }}>Paket seç, talep oluştur</p>
        </div>
      </div>

      {/* Kayıtlı üyeyim */}
      {!legacyDone && (
        <div className="px-5 mb-4">
          <button
            onClick={async () => {
              const supabase = createClient()
              const { data: { user } } = await supabase.auth.getUser()
              if (!user) return
              // Önce member kaydını bul
              const { data: member } = await supabase
                .from('members').select('id').eq('user_id', user.id).is('deleted_at', null).single()
              if (!member) { alert('Üye kaydı bulunamadı'); return }
              const { error } = await supabase.rpc('request_legacy_setup', { p_user_id: user.id })
              if (error) {
                // Hata varsa direkt UPDATE dene
                await supabase.from('members').update({ pending_legacy_setup: true }).eq('user_id', user.id)
              }
              setLegacyDone(true)
            }}
            className="w-full py-3 rounded-2xl text-sm font-bold"
            style={{ background: 'rgba(255,255,255,0.04)', color: '#7b93c4', border: '1px dashed rgba(255,255,255,0.15)' }}
          >
            Daha önce kulübe üye oldum →
          </button>
        </div>
      )}
      {legacyDone && (
        <div className="mx-5 mb-4 px-4 py-3 rounded-2xl text-sm" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>
          ✓ Talebiniz alındı. Yönetici bilgilerinizi işleyecek.
        </div>
      )}

      {loading ? (
        <p className="text-center py-12" style={{ color: '#7b93c4' }}>Yükleniyor...</p>
      ) : (
        <div className="px-4 pb-12">

          {/* Tablo başlıkları */}
          <div
            className="grid rounded-t-2xl px-4 py-3 mb-0.5"
            style={{
              gridTemplateColumns: '1fr 100px 100px',
              background: 'rgba(245,158,11,0.12)',
              border: '1px solid rgba(245,158,11,0.2)',
              borderBottom: 'none',
            }}
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#f59e0b' }}>Tesis Üyelik Süresi</p>
              <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: '#7b93c4' }}>İçerik</p>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-center" style={{ color: '#f59e0b' }}>Hafta İçi</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-center" style={{ color: '#f97316' }}>Genel Kullanım</p>
          </div>

          {/* Satırlar */}
          <div className="space-y-0.5">
            {packages.map((pkg, i) => {
              const isPopular  = pkg.lesson_count === 20
              const isLast     = i === packages.length - 1
              return (
                <div
                  key={pkg.id}
                  className={`grid items-center px-4 py-3.5 ${isLast ? 'rounded-b-2xl' : ''}`}
                  style={{
                    gridTemplateColumns: '1fr 100px 100px',
                    background: isPopular ? 'rgba(245,158,11,0.07)' : 'rgba(255,255,255,0.04)',
                    border: isPopular ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(255,255,255,0.06)',
                    borderTop: 'none',
                  }}
                >
                  {/* İsim + ders */}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-white leading-tight">
                        {DURATION[pkg.lesson_count] ?? `${pkg.lesson_count} Ders`}
                      </p>
                      {isPopular && (
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: 'rgba(245,158,11,0.25)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.4)' }}
                        >
                          ⭐ En Popüler
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5 font-bold" style={{ color: '#7b93c4' }}>{pkg.lesson_count} Ders</p>
                  </div>

                  {/* Hafta İçi fiyat */}
                  <button
                    onClick={() => setSelected({ pkg, type: 'weekday' })}
                    className="flex flex-col items-center justify-center py-2 px-1 rounded-xl active:scale-95 transition-transform"
                    style={{ background: AMBER.bg, border: AMBER.border }}
                  >
                    <p className="text-xs font-bold leading-tight" style={{ color: '#f59e0b' }}>
                      {formatPrice(pkg.weekday_price)}
                    </p>
                    <p className="text-[9px] font-bold mt-0.5" style={{ color: 'rgba(245,158,11,0.6)' }}>Satın Al</p>
                  </button>

                  {/* Genel fiyat */}
                  <button
                    onClick={() => setSelected({ pkg, type: 'general' })}
                    className="flex flex-col items-center justify-center py-2 px-1 rounded-xl active:scale-95 transition-transform"
                    style={{ background: ORANGE.bg, border: ORANGE.border }}
                  >
                    <p className="text-xs font-bold leading-tight" style={{ color: '#f97316' }}>
                      {formatPrice(pkg.general_price)}
                    </p>
                    <p className="text-[9px] font-bold mt-0.5" style={{ color: 'rgba(249,115,22,0.6)' }}>Satın Al</p>
                  </button>
                </div>
              )
            })}
          </div>

          {/* Renk açıklaması */}
          <div className="flex items-center gap-5 mt-4 px-1">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: '#f59e0b' }} />
              <span className="text-xs" style={{ color: '#7b93c4' }}>Hafta İçi</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: '#f97316' }} />
              <span className="text-xs" style={{ color: '#7b93c4' }}>Genel Kullanım</span>
            </div>
          </div>
        </div>
      )}

      {/* Onay bottom-sheet */}
      {selected && !submitted && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="w-full rounded-t-3xl p-6" style={{ background: '#0d1b4b', border: '1px solid rgba(255,255,255,0.10)' }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'rgba(255,255,255,0.15)' }} />
            <h3 className="text-lg font-bold text-white mb-4">Paketi Onaylıyor musunuz?</h3>

            <div
              className="rounded-2xl p-4 mb-5 space-y-1.5"
              style={selected.type === 'weekday'
                ? { background: AMBER.bg, border: AMBER.border }
                : { background: ORANGE.bg, border: ORANGE.border }}
            >
              <p className="font-bold text-white">{DURATION[selected.pkg.lesson_count]}</p>
              <p className="text-sm" style={{ color: '#c8d6f0' }}>{selected.pkg.lesson_count} Ders</p>
              <p className="text-sm font-bold" style={{ color: selected.type === 'weekday' ? '#f59e0b' : '#f97316' }}>
                {selected.type === 'weekday' ? 'Hafta İçi' : 'Genel Kullanım'}
              </p>
              <p className="text-2xl font-bold text-white">{formatPrice(price(selected))}</p>
            </div>

            <p className="text-sm mb-6" style={{ color: '#7b93c4' }}>
              Talebiniz kulüp yönetimine iletilecek. Onaylandıktan sonra üyeliğiniz aktif olacak.
            </p>

            {error && (
              <div className="mb-4 px-4 py-3 rounded-2xl text-sm" style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}>
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setSelected(null); setError('') }}
                disabled={submitting}
                className="flex-1 py-3 rounded-2xl font-bold text-sm disabled:opacity-50"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#7b93c4' }}
              >Vazgeç</button>
              <button
                onClick={handleRequest}
                disabled={submitting}
                className="flex-1 py-3 rounded-2xl font-bold text-sm disabled:opacity-50"
                style={{
                  background: selected.type === 'weekday'
                    ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                    : 'linear-gradient(135deg, #f97316, #ea580c)',
                  color: '#fff',
                }}
              >{submitting ? 'Gönderiliyor...' : 'Talep Oluştur'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Başarı modalı */}
      {submitted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="w-full max-w-sm rounded-3xl p-8 text-center" style={{ background: '#0d1b4b', border: '1px solid rgba(52,211,153,0.3)' }}>
            <div className="text-6xl mb-5">🐎</div>
            <h3 className="text-xl font-bold text-white mb-3">Talebiniz İletildi!</h3>
            <p className="text-sm mb-8 leading-relaxed" style={{ color: '#7b93c4' }}>
              Üyelik talebiniz kulüp onayına gönderildi.{'\n'}
              Onaylandıktan sonra ders haklarınız aktif olacak.
            </p>
            <button
              onClick={() => router.push('/member')}
              className="w-full py-3.5 rounded-2xl font-bold text-sm"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff' }}
            >Panele Dön</button>
          </div>
        </div>
      )}
    </div>
  )
}
