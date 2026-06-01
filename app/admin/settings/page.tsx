'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type Package = { id: string; lesson_count: number; weekday_price: number; general_price: number; is_active: boolean }

const CARD = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }
const INPUT = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: '#c8d6f0' }

export default function SettingsPage() {
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [newPkg, setNewPkg] = useState({ lesson_count: '', weekday_price: '', general_price: '' })
  const [adding, setAdding] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => { loadPackages() }, [])

  const loadPackages = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from('membership_packages').select('id, lesson_count, weekday_price, general_price, is_active').order('lesson_count', { ascending: true })
    setPackages(data ?? [])
    setLoading(false)
  }

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2000) }

  const updatePackage = async (pkg: Package) => {
    setSaving(pkg.id)
    const supabase = createClient()
    await supabase.from('membership_packages').update({ weekday_price: pkg.weekday_price, general_price: pkg.general_price, is_active: pkg.is_active }).eq('id', pkg.id)
    setSaving(null)
    showToast('Kaydedildi.')
  }

  const addPackage = async () => {
    if (!newPkg.lesson_count || !newPkg.weekday_price || !newPkg.general_price) { showToast('Tüm alanları doldurun.'); return }
    setAdding(true)
    const supabase = createClient()
    await supabase.from('membership_packages').insert({ lesson_count: parseInt(newPkg.lesson_count), weekday_price: parseFloat(newPkg.weekday_price), general_price: parseFloat(newPkg.general_price), is_active: true })
    setNewPkg({ lesson_count: '', weekday_price: '', general_price: '' })
    await loadPackages()
    setAdding(false)
  }

  const toggleActive = (id: string, current: boolean) => setPackages(prev => prev.map(p => p.id === id ? { ...p, is_active: !current } : p))
  const updatePrice = (id: string, field: 'weekday_price' | 'general_price', value: string) => setPackages(prev => prev.map(p => p.id === id ? { ...p, [field]: parseFloat(value) || 0 } : p))

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('membership_packages').update({ is_active: false }).eq('id', deleteTarget)
    setDeleteTarget(null)
    setDeleting(false)
    await loadPackages()
    showToast('Paket kaldırıldı.')
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Ayarlar</h1>

      <p className="text-sm font-bold mb-4" style={{ color: '#7b93c4' }}>Paket Fiyatları</p>

      {loading ? (
        <p className="text-center py-8" style={{ color: '#7b93c4' }}>Yükleniyor...</p>
      ) : (
        <div className="space-y-3">
          {packages.map(pkg => (
            <div key={pkg.id} className="rounded-2xl p-4" style={CARD}>
              <div className="flex items-center justify-between mb-3">
                <button className="flex items-center gap-2" onClick={() => setDeleteTarget(pkg.id)}>
                  <span className="text-2xl font-bold text-white">{pkg.lesson_count}</span>
                  <span className="text-sm" style={{ color: '#7b93c4' }}>Ders</span>
                </button>
                <button
                  onClick={() => toggleActive(pkg.id, pkg.is_active)}
                  className="px-3 py-1 rounded-full text-xs font-bold"
                  style={pkg.is_active
                    ? { background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }
                    : { background: 'rgba(255,255,255,0.06)', color: '#7b93c4', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  {pkg.is_active ? 'Aktif' : 'Pasif'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <p className="text-xs mb-1 font-bold" style={{ color: '#7b93c4' }}>Hafta İçi (₺)</p>
                  <input type="number" value={pkg.weekday_price} onChange={e => updatePrice(pkg.id, 'weekday_price', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={INPUT} />
                </div>
                <div>
                  <p className="text-xs mb-1 font-bold" style={{ color: '#7b93c4' }}>Genel (₺)</p>
                  <input type="number" value={pkg.general_price} onChange={e => updatePrice(pkg.id, 'general_price', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={INPUT} />
                </div>
              </div>
              <button onClick={() => updatePackage(pkg)} disabled={saving === pkg.id}
                className="w-full py-2 rounded-xl text-sm font-bold disabled:opacity-50"
                style={{ background: '#f59e0b', color: '#0a0f2e' }}>
                {saving === pkg.id ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Yeni paket */}
      <div className="mt-6 rounded-2xl p-4" style={CARD}>
        <p className="text-sm font-bold text-white mb-4">Yeni Paket Ekle</p>
        <div className="space-y-3">
          <div>
            <p className="text-xs mb-1 font-bold" style={{ color: '#7b93c4' }}>Ders Sayısı</p>
            <input type="number" value={newPkg.lesson_count} onChange={e => setNewPkg(p => ({ ...p, lesson_count: e.target.value }))}
              placeholder="0" className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={INPUT} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs mb-1 font-bold" style={{ color: '#7b93c4' }}>Hafta İçi (₺)</p>
              <input type="number" value={newPkg.weekday_price} onChange={e => setNewPkg(p => ({ ...p, weekday_price: e.target.value }))}
                placeholder="0" className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={INPUT} />
            </div>
            <div>
              <p className="text-xs mb-1 font-bold" style={{ color: '#7b93c4' }}>Genel (₺)</p>
              <input type="number" value={newPkg.general_price} onChange={e => setNewPkg(p => ({ ...p, general_price: e.target.value }))}
                placeholder="0" className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={INPUT} />
            </div>
          </div>
          <button onClick={addPackage} disabled={adding}
            className="w-full py-2 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ background: '#f59e0b', color: '#0a0f2e' }}>
            {adding ? 'Ekleniyor...' : 'Paket Ekle'}
          </button>
        </div>
      </div>

      {/* Silme onay modalı */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[70] flex items-end" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="w-full rounded-t-3xl p-6" style={{ background: '#0d1b4b', border: '1px solid rgba(255,255,255,0.10)' }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'rgba(255,255,255,0.15)' }} />
            <h3 className="text-lg font-bold text-white mb-2">Paketi Kaldır</h3>
            <p className="text-sm mb-6" style={{ color: '#7b93c4' }}>
              Bu paket pasif yapılacak ve üyelik seçeneklerinden kaldırılacak. Mevcut üyelikler etkilenmez.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting}
                className="flex-1 py-3 rounded-2xl font-bold text-sm disabled:opacity-50"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#7b93c4' }}>
                Vazgeç
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 py-3 rounded-2xl font-bold text-sm disabled:opacity-50"
                style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}>
                {deleting ? 'Kaldırılıyor...' : 'Kaldır'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-2xl text-sm font-bold text-white"
          style={{ background: 'rgba(52,211,153,0.2)', border: '1px solid rgba(52,211,153,0.4)', backdropFilter: 'blur(8px)' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
