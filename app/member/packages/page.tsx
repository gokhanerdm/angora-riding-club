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

type PackageType = 'weekday' | 'general'

function formatPrice(p: number) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency', currency: 'TRY', minimumFractionDigits: 0,
  }).format(p)
}

const CARD = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }

export default function PackagesPage() {
  const [packages, setPackages]     = useState<Package[]>([])
  const [loading, setLoading]       = useState(true)
  const [activeType, setActiveType] = useState<PackageType>('weekday')
  const [confirmPkg, setConfirmPkg] = useState<Package | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)
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
    if (!confirmPkg) return
    setSubmitting(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSubmitting(false); return }

    const { error: rpcError } = await supabase.rpc('create_membership_request', {
      user_id: user.id,
      p_package_id: confirmPkg.id,
      p_request_type: activeType,
    })

    setSubmitting(false)
    if (rpcError) {
      setError(rpcError.message)
    } else {
      setConfirmPkg(null)
      setSubmitted(true)
    }
  }

  const activePrice = (pkg: Package) =>
    activeType === 'weekday' ? pkg.weekday_price : pkg.general_price

  const typeName = activeType === 'weekday' ? 'Hafta İçi' : 'Genel'

  return (
    <div
      className="min-h-screen"
      style={{ background: 'linear-gradient(160deg, #0a0f2e, #0d1b4b, #071428)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-12 pb-4">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-bold flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.06)', color: '#7b93c4', border: '1px solid rgba(255,255,255,0.08)' }}
        >←</button>
        <div>
          <h1 className="text-xl font-bold text-white">Üyelik Seçenekleri</h1>
          <p className="text-xs mt-0.5" style={{ color: '#7b93c4' }}>Paketi seç, talep oluştur</p>
        </div>
      </div>

      <div className="px-5 pb-10">
        {/* Tür seçici */}
        <div
          className="flex p-1 rounded-2xl mb-6"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        >
          {(['weekday', 'general'] as PackageType[]).map(type => (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={activeType === type
                ? { background: '#f59e0b', color: '#0a0f2e' }
                : { color: '#7b93c4' }}
            >
              {type === 'weekday' ? 'Hafta İçi' : 'Genel'}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-center py-12" style={{ color: '#7b93c4' }}>Yükleniyor...</p>
        ) : (
          <div className="space-y-3">
            {packages.map(pkg => (
              <div key={pkg.id} className="rounded-2xl p-5" style={CARD}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-4xl font-bold text-white leading-none">{pkg.lesson_count}</p>
                    <p className="text-sm mt-1" style={{ color: '#7b93c4' }}>Ders · {typeName} Üyeliği</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold" style={{ color: '#f59e0b' }}>
                      {formatPrice(activePrice(pkg))}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#4a6190' }}>
                      {formatPrice(Math.round(activePrice(pkg) / pkg.lesson_count))} / ders
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setConfirmPkg(pkg)}
                  className="w-full py-3.5 rounded-2xl font-bold text-sm tracking-wide transition-opacity active:opacity-80"
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    color: '#fff',
                    boxShadow: '0 4px 16px rgba(245,158,11,0.25)',
                  }}
                >
                  Üyelik Talebi Oluştur
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Onay bottom-sheet */}
      {confirmPkg && !submitted && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div
            className="w-full rounded-t-3xl p-6"
            style={{ background: '#0d1b4b', border: '1px solid rgba(255,255,255,0.10)' }}
          >
            <div
              className="w-10 h-1 rounded-full mx-auto mb-5"
              style={{ background: 'rgba(255,255,255,0.15)' }}
            />
            <h3 className="text-lg font-bold text-white mb-4">Üyelik Talebi</h3>

            <div className="rounded-2xl p-4 mb-5" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <p className="font-bold text-white">
                {confirmPkg.lesson_count} Ders — {typeName} Üyeliği
              </p>
              <p className="text-2xl font-bold mt-1" style={{ color: '#f59e0b' }}>
                {formatPrice(activePrice(confirmPkg))}
              </p>
              <p className="text-xs mt-1" style={{ color: '#7b93c4' }}>
                {formatPrice(Math.round(activePrice(confirmPkg) / confirmPkg.lesson_count))} / ders
              </p>
            </div>

            <p className="text-sm mb-6" style={{ color: '#7b93c4' }}>
              Talebiniz kulüp yönetimine iletilecek. Onaylandıktan sonra üyeliğiniz ve ders haklarınız aktif olacak.
            </p>

            {error && (
              <div className="mb-4 px-4 py-3 rounded-2xl text-sm" style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}>
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setConfirmPkg(null); setError('') }}
                disabled={submitting}
                className="flex-1 py-3 rounded-2xl font-bold text-sm disabled:opacity-50"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#7b93c4' }}
              >
                Vazgeç
              </button>
              <button
                onClick={handleRequest}
                disabled={submitting}
                className="flex-1 py-3 rounded-2xl font-bold text-sm disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff' }}
              >
                {submitting ? 'Gönderiliyor...' : 'Talep Oluştur'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Başarı modalı */}
      {submitted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div
            className="w-full max-w-sm rounded-3xl p-8 text-center"
            style={{ background: '#0d1b4b', border: '1px solid rgba(52,211,153,0.3)' }}
          >
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
            >
              Panele Dön
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
