'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Package {
  id: string
  lesson_count: number
  weekday_price: number
  general_price: number
}

export default function PackagesList() {
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)

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

  if (loading) return <p className="text-gray-500">Yükleniyor...</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left py-3 px-4">Ders</th>
            <th className="text-right py-3 px-4">Hafta İçi</th>
            <th className="text-right py-3 px-4">Genel</th>
            <th className="text-center py-3 px-4">İşlem</th>
          </tr>
        </thead>
        <tbody>
          {packages.map((pkg) => (
            <tr key={pkg.id} className="border-b hover:bg-gray-50">
              <td className="py-3 px-4 font-medium">{pkg.lesson_count}</td>
              <td className="py-3 px-4 text-right">{formatPrice(pkg.weekday_price)}</td>
              <td className="py-3 px-4 text-right">{formatPrice(pkg.general_price)}</td>
              <td className="py-3 px-4 text-center">
                <button 
                  onClick={() => alert('Satın alma talebi gönderildi!')}
                  className="bg-amber-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-amber-600"
                >
                  Talep Gönder
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}