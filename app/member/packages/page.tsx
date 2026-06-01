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

function formatPrice(p: number) {
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0 }).format(p) + ' ₺'
}

// Her paketten 2 kart: hafta içi + genel, ders sayısına göre sıralı
function buildCards(packages: Package[]): Selection[] {
  const cards: Selection[] = []
  for (const pkg of packages) {
    cards.push({ pkg, type: 'weekday' })
    cards.push({ pkg, type: 'general' })
  }
  return cards
}

export default function PackagesPage() {
  const [packages, setPackages]     = useState<Package[]>([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState<Selection | null>(null)
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
    if (rpcError) { setError(rpcError.message) }
    else { setSelected(null); setSubmitted(true) }
  }

  const cards = buildCards(packages)
  const price = (s: Selection) =>
    s.type === 'weekday' ? s.pkg.weekday_price : s.pkg.general_price

  // Hafta içi: amber #f59e0b — Genel: turuncu #f97316
  const tone = (type: 'weekday' | 'general') =>
    type === 'weekday'
      ? { accent: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', label: 'Hafta İçi' }
      : { accent: '#f97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.35)',  label: 'Genel' }

  return (
    <div
      className="min-h-screen"
      style={{ background: 'linear-gradient(160deg, #0a0f2e, #0d1b4b, #071428)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-12 pb-5">
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

      {/* Renk açıklaması */}
      <div className="flex items-center gap-4 px-5 mb-5">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#f59e0b' }} />
          <span className="text-xs" style={{ color: '#7b93c4' }}>Hafta İçi</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#f97316' }} />
          <span className="text-xs" style={{ color: '#7b93c4' }}>Genel</span>
        </div>
      </div>

      {/* Kart grid */}
      {loading ? (
        <p className="text-center py-12" style={{ color: '#7b93c4' }}>Yükleniyor...</p>
      ) : (
        <div className="grid grid-cols-3 gap-3 px-4 pb-10">
          {cards.map((s, i) => {
            const t = tone(s.type)
            return (
              <button
                key={i}
                onClick={() => setSelected(s)}
                className="flex flex-col items-center justify-center py-5 px-2 rounded-3xl active:scale-95 transition-transform"
                style={{ background: t.bg, border: `1px solid ${t.border}` }}
              >
                <div className="flex items-baseline gap-1">
                  <p className="text-3xl font-bold text-white leading-none">{s.pkg.lesson_count}</p>
                  <p className="text-[11px] font-bold" style={{ color: '#c8d6f0' }}>Ders</p>
                </div>
                <p className="text-[11px] font-bold mt-2" style={{ color: t.accent }}>{t.label}</p>
                <p className="text-xs font-bold mt-2 text-white">{formatPrice(price(s))}</p>
              </button>
            )
          })}
        </div>
      )}

      {/* Onay bottom-sheet */}
      {selected && !submitted && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="w-full rounded-t-3xl p-6" style={{ background: '#0d1b4b', border: '1px solid rgba(255,255,255,0.10)' }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'rgba(255,255,255,0.15)' }} />
            <h3 className="text-lg font-bold text-white mb-4">Paketi Onaylıyor musunuz?</h3>

            <div
              className="rounded-2xl p-4 mb-5"
              style={{
                background: `rgba(${selected.type === 'weekday' ? '245,158,11' : '249,115,22'},0.08)`,
                border: `1px solid ${tone(selected.type).border}`,
              }}
            >
              <p className="font-bold text-white text-lg">
                {selected.pkg.lesson_count} Ders — {tone(selected.type).label} Üyeliği
              </p>
              <p className="text-2xl font-bold mt-1" style={{ color: tone(selected.type).accent }}>
                {formatPrice(price(selected))}
              </p>
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
                style={{ background: `linear-gradient(135deg, ${tone(selected.type).accent}, ${selected.type === 'weekday' ? '#d97706' : '#ea580c'})`, color: '#fff' }}
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
              Üyelik talebiniz kulüp onayına gönderildi. Onaylandıktan sonra ders haklarınız aktif olacak.
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
