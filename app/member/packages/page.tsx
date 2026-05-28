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

  useEffect(() => {
    loadPackages()
  }, [])

  const loadPackages = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('membership_packages')
      .select('id, lesson_count, weekday_price, general_price')
      .eq('is_active', true)
      .order('lesson_count', { ascending: true })

    if (data) {
      setPackages(data)
    }
    setLoading(false)
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0
    }).format(price)
  }

  const handlePackageClick = async (pkg: Package, type: 'weekday' | 'general') => {
  const price = type === 'weekday' ? pkg.weekday_price : pkg.general_price
  const typeText = type === 'weekday' ? 'Hafta İçi' : 'Genel'
  
  if (!confirm(`${pkg.lesson_count} Ders - ${typeText} (${formatPrice(price)})\n\nBu paketi almak istiyor musunuz?`)) {
    return
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { error } = await supabase.rpc('create_membership_request', {
    user_id: user.id,
    p_package_id: pkg.id,
    p_request_type: type
  })

  if (error) {
    alert('Hata: ' + error.message)
  } else {
    alert('Satın alma talebiniz alındı. Admin onayından sonra üyeliğiniz aktif olacaktır.')
    router.push('/member')
  }
}

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <p className="text-gray-500">Yükleniyor...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-gray-600 hover:text-gray-900 mb-4"
          >
            ← Geri
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Üyelik Seçenekleri</h1>
          <p className="text-gray-600 mt-2">Size uygun paketi seçin ve satın alma talebi gönderin.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {packages.map((pkg) => (
            <div key={pkg.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="text-center mb-6">
                <div className="text-5xl font-bold text-gray-900 mb-2">{pkg.lesson_count}</div>
                <div className="text-gray-600">Ders</div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => handlePackageClick(pkg, 'weekday')}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 py-4 px-6 rounded-xl text-left transition"
                >
                  <div className="text-sm text-gray-600 mb-1">Hafta İçi</div>
                  <div className="text-xl font-bold">{formatPrice(pkg.weekday_price)}</div>
                </button>

                <button
                  onClick={() => handlePackageClick(pkg, 'general')}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white py-4 px-6 rounded-xl text-left transition"
                >
                  <div className="text-sm text-amber-100 mb-1">Genel</div>
                  <div className="text-xl font-bold">{formatPrice(pkg.general_price)}</div>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}