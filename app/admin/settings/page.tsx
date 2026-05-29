'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type Package = {
  id: string
  lesson_count: number
  weekday_price: number
  general_price: number
  is_active: boolean
}

export default function SettingsPage() {
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [newPackage, setNewPackage] = useState({ lesson_count: '', weekday_price: '', general_price: '' })
  const [adding, setAdding] = useState(false)

  useEffect(() => { loadPackages() }, [])

  const loadPackages = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('membership_packages')
      .select('id, lesson_count, weekday_price, general_price, is_active')
      .order('lesson_count', { ascending: true })
    setPackages(data ?? [])
    setLoading(false)
  }

  const updatePackage = async (pkg: Package) => {
    setSaving(pkg.id)
    const supabase = createClient()
    await supabase.from('membership_packages').update({
      weekday_price: pkg.weekday_price,
      general_price: pkg.general_price,
      is_active: pkg.is_active
    }).eq('id', pkg.id)
    setSaving(null)
    alert('Kaydedildi.')
  }

  const addPackage = async () => {
    if (!newPackage.lesson_count || !newPackage.weekday_price || !newPackage.general_price) {
      alert('Tüm alanları doldurun.')
      return
    }
    setAdding(true)
    const supabase = createClient()
    await supabase.from('membership_packages').insert({
      lesson_count: parseInt(newPackage.lesson_count),
      weekday_price: parseFloat(newPackage.weekday_price),
      general_price: parseFloat(newPackage.general_price),
      is_active: true
    })
    setNewPackage({ lesson_count: '', weekday_price: '', general_price: '' })
    await loadPackages()
    setAdding(false)
  }

  const toggleActive = (id: string, current: boolean) => {
    setPackages(prev => prev.map(p => p.id === id ? { ...p, is_active: !current } : p))
  }

  const updatePrice = (id: string, field: 'weekday_price' | 'general_price', value: string) => {
    setPackages(prev => prev.map(p => p.id === id ? { ...p, [field]: parseFloat(value) || 0 } : p))
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Ayarlar</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Paket Fiyatları</h2>

        {loading ? <p className="text-gray-500">Yükleniyor...</p> : (
          <div className="space-y-3">
            {packages.map(pkg => (
              <div key={pkg.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <div className="w-20 text-center">
                  <p className="text-2xl font-bold text-gray-900">{pkg.lesson_count}</p>
                  <p className="text-xs text-gray-500">Ders</p>
                </div>

                <div className="flex-1 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 font-bold mb-1 block">Hafta İçi (₺)</label>
                    <input
                      type="number"
                      value={pkg.weekday_price}
                      onChange={e => updatePrice(pkg.id, 'weekday_price', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-bold mb-1 block">Genel (₺)</label>
                    <input
                      type="number"
                      value={pkg.general_price}
                      onChange={e => updatePrice(pkg.id, 'general_price', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleActive(pkg.id, pkg.is_active)}
                    className={`px-3 py-1 rounded-full text-xs font-bold ${pkg.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {pkg.is_active ? 'Aktif' : 'Pasif'}
                  </button>
                  <button
                    onClick={() => updatePackage(pkg)}
                    disabled={saving === pkg.id}
                    className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-700 disabled:opacity-50">
                    {saving === pkg.id ? '...' : 'Kaydet'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Yeni paket ekle */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Yeni Paket Ekle</h3>
          <div className="flex gap-3 items-end">
            <div>
              <label className="text-xs text-gray-500 font-bold mb-1 block">Ders Sayısı</label>
              <input
                type="number"
                value={newPackage.lesson_count}
                onChange={e => setNewPackage(p => ({ ...p, lesson_count: e.target.value }))}
                className="w-24 px-3 py-2 border rounded-lg text-sm text-gray-900"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-bold mb-1 block">Hafta İçi (₺)</label>
              <input
                type="number"
                value={newPackage.weekday_price}
                onChange={e => setNewPackage(p => ({ ...p, weekday_price: e.target.value }))}
                className="w-32 px-3 py-2 border rounded-lg text-sm text-gray-900"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-bold mb-1 block">Genel (₺)</label>
              <input
                type="number"
                value={newPackage.general_price}
                onChange={e => setNewPackage(p => ({ ...p, general_price: e.target.value }))}
                className="w-32 px-3 py-2 border rounded-lg text-sm text-gray-900"
                placeholder="0"
              />
            </div>
            <button
              onClick={addPackage}
              disabled={adding}
              className="bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-amber-600 disabled:opacity-50">
              {adding ? '...' : 'Ekle'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}