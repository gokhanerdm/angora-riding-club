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

export default function PackagesPage() {
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => { loadPackages() }, [])

  const loadPackages = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('membership_packages')
      .select('id, lesson_count, weekday_price, general_price')
      .eq('is_active', true)
      .order('lesson_count', { ascending: true })
    if (data) setPackages(data)
    setLoading(false)
  }

  const formatPrice = (p: number) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(p)

  const handlePackageClick = async (pkg: Package, type: 'weekday' | 'general') => {
    const price = type === 'weekday' ? pkg.weekday_price : pkg.general_price
    const typeText = type === 'weekday' ? 'Hafta İçi' : 'Genel'
    if (!confirm(`${pkg.lesson_count} Ders — ${typeText} (${formatPrice(price)})\n\nBu paketi almak istiyor musunuz?`)) return

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.rpc('create_membership_request', {
      user_id: user.id,
      p_package_id: pkg.id,
      p_request_type: type,
    })

    if (error) alert('Hata: ' + error.message)
    else {
      alert('Talebiniz alındı. Admin onayından sonra üyeliğiniz aktif olacaktır.')
      router.push('/member')
    }
  }

  return (
    <div
      className="min-h-screen px-4 py-6"
      style={{ background: 'linear-gradient(160deg, #0a0f2e, #0d1b4b, #071428)' }}
    >
      <div className="flex items-center gap-3 mb-8 pt-10">
        <button onClick={() => router.back()}
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-bold"
          style={{ background: 'rgba(255,255,255,0.06)', color: '#7b93c4', border: '1px solid rgba(255,255,255,0.08)' }}>
          ←
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Üyelik Seçenekleri</h1>
          <p className="text-xs mt-0.5" style={{ color: '#7b93c4' }}>Size uygun paketi seçin</p>
        </div>
      </div>

      {loading ? (
        <p className="text-center py-12" style={{ color: '#7b93c4' }}>Yükleniyor...</p>
      ) : (
        <div className="space-y-4 max-w-md mx-auto">
          {packages.map(pkg => (
            <div
              key={pkg.id}
              className="rounded-2xl p-5"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="text-center mb-5">
                <span className="text-5xl font-bold text-white">{pkg.lesson_count}</span>
                <span className="text-lg ml-2" style={{ color: '#7b93c4' }}>Ders</span>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => handlePackageClick(pkg, 'weekday')}
                  className="w-full py-4 px-5 rounded-2xl text-left transition-opacity active:opacity-80"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
                >
                  <p className="text-xs mb-1" style={{ color: '#7b93c4' }}>Hafta İçi</p>
                  <p className="text-xl font-bold text-white">{formatPrice(pkg.weekday_price)}</p>
                </button>

                <button
                  onClick={() => handlePackageClick(pkg, 'general')}
                  className="w-full py-4 px-5 rounded-2xl text-left transition-opacity active:opacity-80"
                  style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}
                >
                  <p className="text-xs mb-1" style={{ color: '#f59e0b' }}>Genel</p>
                  <p className="text-xl font-bold text-white">{formatPrice(pkg.general_price)}</p>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
