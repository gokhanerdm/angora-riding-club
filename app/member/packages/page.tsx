'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

interface Package {
  id: string
  lesson_count: number
  weekday_price: number
  general_price: number
}

interface Selection {
  pkg: Package
}

const DURATION: Record<number, string> = {
  4:  '1 Aylık Tesis Üyeliği',
  8:  '2 Aylık Tesis Üyeliği',
  12: '3 Aylık Tesis Üyeliği',
  20: '5 Aylık Tesis Üyeliği',
  30: '8 Aylık Tesis Üyeliği',
  60: '12 Aylık Tesis Üyeliği',
  90: '18 Aylık Tesis Üyeliği',
}

const FAMILY_DURATION: Record<number, string> = {
  30: '8 Aylık Tesis Üyeliği',
  60: '6 Aylık Tesis Üyeliği',
  90: '12 Aylık Tesis Üyeliği',
}

function formatPrice(p: number) {
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0 }).format(p) + ' ₺'
}

const CARD  = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }
const AMBER = { accent: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)' }
const ORANGE= { accent: '#f97316', bg: 'rgba(249,115,22,0.12)',  border: '1px solid rgba(249,115,22,0.3)' }

export default function PackagesPage() {
  const [packages, setPackages]         = useState<Package[]>([])
  const [familyPackages, setFamilyPackages] = useState<Package[]>([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState<Selection | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)
  const [legacyDone,  setLegacyDone]  = useState(false)
  const [familyDone,  setFamilyDone]  = useState(false)
  const [hasPackage,  setHasPackage]  = useState(true) // varsayılan gizli, kontrol sonrası gösterilir
  const [profileCompleted, setProfileCompleted] = useState(true)
  const [error, setError]           = useState('')
  const router       = useRouter()
  const searchParams = useSearchParams()
  const overrideUid  = searchParams.get('uid') // admin üye adına işlem yaparsa

  useEffect(() => {
    loadPackages()
    if (searchParams.get('submitted') === '1') setSubmitted(true)
    // Üyenin aktif paketi var mı kontrol et
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('members').select('id, pending_legacy_setup, pending_family_setup, profile_completed').eq('user_id', user.id).single().then(async ({ data: m }) => {
        if (!m) return
        setProfileCompleted(m.profile_completed)
        // Daha önce "eski üyeyim" isteği göndermişse tekrar gösterme
        if (m.pending_legacy_setup) { setLegacyDone(true); setHasPackage(true); return }
        // Daha önce "aile üyesiyim" isteği göndermişse tekrar gösterme
        if (m.pending_family_setup) { setFamilyDone(true); setHasPackage(true); return }
        // Kendi paketi var mı?
        const { data: ownMs } = await supabase.from('memberships').select('id').eq('member_id', m.id).limit(1)
        if ((ownMs ?? []).length > 0) { setHasPackage(true); return }
        // Aile üyesi ise ailenin paylaşılan paketi var mı? (kendi paketi olmayan aile üyeleri "Üyeliğim Var" ekranını görmemeli)
        const { data: fm } = await supabase.from('family_members').select('family_id').eq('member_id', m.id).limit(1)
        if (fm && fm.length > 0) {
          const { data: famMs } = await supabase.from('memberships').select('id').eq('family_id', fm[0].family_id).eq('is_current', true).limit(1)
          setHasPackage((famMs ?? []).length > 0)
          return
        }
        setHasPackage(false)
      })
    })
  }, [])

  const loadPackages = async () => {
    const supabase = createClient()
    const [{ data: ind }, { data: fam }] = await Promise.all([
      supabase.from('membership_packages').select('id, lesson_count, weekday_price, general_price')
        .eq('is_active', true).eq('is_family', false).gt('general_price', 0).order('lesson_count', { ascending: true }),
      supabase.from('membership_packages').select('id, lesson_count, weekday_price, general_price')
        .eq('is_active', true).eq('is_family', true).gt('general_price', 0).order('lesson_count', { ascending: true }),
    ])
    if (ind) setPackages(ind)
    if (fam) setFamilyPackages(fam)
    setLoading(false)
  }

  const handleRequest = async () => {
    if (!selected) return
    if (!profileCompleted) {
      router.push(`/member/profile-setup?action=package&package_id=${selected.pkg.id}&type=general`)
      return
    }
    setSubmitting(true)
    setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSubmitting(false); return }

    const { error: rpcError } = await supabase.rpc('create_membership_request', {
      user_id: overrideUid ?? user.id,
      p_package_id: selected.pkg.id,
      p_request_type: 'general',
    })
    setSubmitting(false)
    if (rpcError) setError(rpcError.message)
    else { setSelected(null); setSubmitted(true); setHasPackage(true) }
  }

  const price = (s: Selection) => s.pkg.general_price

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

      {/* Kayıtlı üyeyim / Aile üyesiyim — sadece hiç paketi olmayan üyelere göster */}
      {!hasPackage && !legacyDone && !familyDone && (
        <div className="px-5 mb-4 space-y-2">
          <button
            onClick={async () => {
              if (!profileCompleted) {
                router.push('/member/profile-setup?action=legacy')
                return
              }
              const supabase = createClient()
              const { data: { user } } = await supabase.auth.getUser()
              if (!user) return
              const targetUid = overrideUid ?? user.id
              const { error } = await supabase.rpc('request_legacy_setup', { p_user_id: targetUid })
              if (error) {
                setError('Talep gönderilemedi, lütfen tekrar deneyin.')
                return
              }
              setLegacyDone(true)
              setHasPackage(true)
            }}
            className="w-full py-3 rounded-2xl text-sm font-bold"
            style={{ background: 'rgba(255,255,255,0.04)', color: '#7b93c4', border: '1px dashed rgba(255,255,255,0.15)' }}
          >
            Üyeliğim Var →
          </button>
          <button
            onClick={async () => {
              if (!profileCompleted) {
                router.push('/member/profile-setup?action=family')
                return
              }
              const supabase = createClient()
              const { data: { user } } = await supabase.auth.getUser()
              if (!user) return
              const targetUid = overrideUid ?? user.id
              const { error } = await supabase.rpc('request_family_setup', { p_user_id: targetUid })
              if (error) {
                setError('Talep gönderilemedi, lütfen tekrar deneyin.')
                return
              }
              setFamilyDone(true)
              setHasPackage(true)
            }}
            className="w-full py-3 rounded-2xl text-sm font-bold"
            style={{ background: 'rgba(255,255,255,0.04)', color: '#7b93c4', border: '1px dashed rgba(255,255,255,0.15)' }}
          >
            Aile Üyesiyim →
          </button>
        </div>
      )}
      {legacyDone && (
        <div className="mx-5 mb-4 px-4 py-3 rounded-2xl text-sm" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>
          ✓ Talebiniz alındı. Yönetici bilgilerinizi işleyecek.
        </div>
      )}
      {familyDone && (
        <div className="mx-5 mb-4 px-4 py-3 rounded-2xl text-sm" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>
          ✓ Talebiniz alındı. Yönetici sizi aile grubuna ekleyecek.
        </div>
      )}

      {loading ? (
        <p className="text-center py-12" style={{ color: '#7b93c4' }}>Yükleniyor...</p>
      ) : (
        <div className="px-4 pb-12">

          {/* Başlık */}
          <p className="text-xs font-bold uppercase tracking-widest mb-2 px-1" style={{ color: '#f59e0b' }}>Üyelikler</p>

          {/* Tablo başlıkları */}
          <div
            className="grid rounded-t-2xl px-4 py-3 mb-0.5"
            style={{
              gridTemplateColumns: '1fr 110px',
              background: 'rgba(245,158,11,0.12)',
              border: '1px solid rgba(245,158,11,0.2)',
              borderBottom: 'none',
            }}
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#f59e0b' }}>Tesis Üyelik Süresi</p>
              <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: '#7b93c4' }}>İçerik</p>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-center" style={{ color: '#f59e0b' }}>Fiyat</p>
          </div>

          {/* Satırlar */}
          <div className="space-y-0.5">
            {packages.map((pkg, i) => {
              const isPopular = pkg.lesson_count === 20
              const isLast    = i === packages.length - 1
              return (
                <div
                  key={pkg.id}
                  className={`grid items-center px-4 py-3.5 ${isLast ? 'rounded-b-2xl' : ''}`}
                  style={{
                    gridTemplateColumns: '1fr 110px',
                    background: isPopular ? 'rgba(245,158,11,0.07)' : 'rgba(255,255,255,0.04)',
                    border: isPopular ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(255,255,255,0.06)',
                    borderTop: 'none',
                  }}
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-white leading-tight">
                        {DURATION[pkg.lesson_count] ?? `${pkg.lesson_count} Ders`}
                      </p>
                      {isPopular && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: 'rgba(245,158,11,0.25)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.4)' }}>
                          ⭐ En Popüler
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5 font-bold" style={{ color: '#7b93c4' }}>{pkg.lesson_count} Ders</p>
                  </div>
                  <button
                    onClick={() => setSelected({ pkg })}
                    className="flex flex-col items-center justify-center py-2 px-1 rounded-xl active:scale-95 transition-transform"
                    style={{ background: AMBER.bg, border: AMBER.border }}
                  >
                    <p className="text-xs font-bold leading-tight" style={{ color: '#f59e0b' }}>{formatPrice(pkg.general_price)}</p>
                    <p className="text-[9px] font-bold mt-0.5" style={{ color: 'rgba(245,158,11,0.6)' }}>Satın Al</p>
                  </button>
                </div>
              )
            })}
          </div>

          {/* Aile Üyelikleri */}
          {familyPackages.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-bold uppercase tracking-widest mb-2 px-1" style={{ color: '#a78bfa' }}>Aile Üyelikleri</p>
              <div
                className="grid rounded-t-2xl px-4 py-3 mb-0.5"
                style={{
                  gridTemplateColumns: '1fr 110px',
                  background: 'rgba(167,139,250,0.12)',
                  border: '1px solid rgba(167,139,250,0.2)',
                  borderBottom: 'none',
                }}
              >
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#a78bfa' }}>Tesis Üyelik Süresi</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: '#7b93c4' }}>İçerik</p>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-center" style={{ color: '#a78bfa' }}>Fiyat</p>
              </div>
              <div className="space-y-0.5">
                {familyPackages.map((pkg, i) => {
                  const isLast = i === familyPackages.length - 1
                  return (
                    <div
                      key={pkg.id}
                      className={`grid items-center px-4 py-3.5 ${isLast ? 'rounded-b-2xl' : ''}`}
                      style={{
                        gridTemplateColumns: '1fr 110px',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(167,139,250,0.12)',
                        borderTop: 'none',
                      }}
                    >
                      <div>
                        <p className="text-sm font-bold text-white leading-tight">
                          {FAMILY_DURATION[pkg.lesson_count] ?? DURATION[pkg.lesson_count] ?? `${pkg.lesson_count} Ders`}
                        </p>
                        <p className="text-xs mt-0.5 font-bold" style={{ color: '#7b93c4' }}>{pkg.lesson_count} Ders · Aile</p>
                      </div>
                      <button
                        onClick={() => setSelected({ pkg })}
                        className="flex flex-col items-center justify-center py-2 px-1 rounded-xl active:scale-95 transition-transform"
                        style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)' }}
                      >
                        <p className="text-xs font-bold leading-tight" style={{ color: '#a78bfa' }}>{formatPrice(pkg.general_price)}</p>
                        <p className="text-[9px] font-bold mt-0.5" style={{ color: 'rgba(167,139,250,0.6)' }}>Satın Al</p>
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Onay bottom-sheet */}
      {selected && !submitted && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="w-full rounded-t-3xl p-6" style={{ background: '#0d1b4b', border: '1px solid rgba(255,255,255,0.10)' }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'rgba(255,255,255,0.15)' }} />
            <h3 className="text-lg font-bold text-white mb-4">Paketi Onaylıyor musunuz?</h3>

            <div className="rounded-2xl p-4 mb-5 space-y-1.5" style={{ background: AMBER.bg, border: AMBER.border }}>
              <p className="font-bold text-white">{DURATION[selected.pkg.lesson_count]}</p>
              <p className="text-sm" style={{ color: '#c8d6f0' }}>{selected.pkg.lesson_count} Ders</p>
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
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff' }}
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
