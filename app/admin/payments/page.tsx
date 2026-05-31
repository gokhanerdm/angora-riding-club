'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const MONTHS_TR = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]} ${d.getFullYear()}`
}

function formatPrice(p: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(p)
}

type Payment = { id: string; member_name: string; amount: number; payment_method: string; payment_date: string }

const METHOD_FILTERS = ['Tümü', 'Nakit', 'Havale', 'Kart']

const METHOD_COLOR: Record<string, string> = {
  nakit:  '#34d399',
  havale: '#38bdf8',
  kart:   '#a78bfa',
}

const CARD = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [methodFilter, setMethodFilter] = useState('Tümü')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('payment_transactions')
      .select('id, amount, payment_method, payment_date, members(name, surname)')
      .is('deleted_at', null)
      .order('payment_date', { ascending: false })
    setPayments((data ?? []).map((p: any) => {
      const m = Array.isArray(p.members) ? p.members[0] : p.members
      return { id: p.id, member_name: m ? `${m.name} ${m.surname}` : 'Bilinmiyor', amount: p.amount, payment_method: p.payment_method, payment_date: p.payment_date }
    }))
    setLoading(false)
  }

  const filtered = payments.filter(p => {
    const matchSearch = p.member_name.toLowerCase().includes(search.toLowerCase())
    const matchMethod = methodFilter === 'Tümü' || p.payment_method === methodFilter.toLowerCase()
    const matchFrom = !dateFrom || p.payment_date >= dateFrom
    const matchTo = !dateTo || p.payment_date <= dateTo
    return matchSearch && matchMethod && matchFrom && matchTo
  })

  const total       = filtered.reduce((s, p) => s + p.amount, 0)
  const totalNakit  = filtered.filter(p => p.payment_method === 'nakit').reduce((s, p) => s + p.amount, 0)
  const totalHavale = filtered.filter(p => p.payment_method === 'havale').reduce((s, p) => s + p.amount, 0)
  const totalKart   = filtered.filter(p => p.payment_method === 'kart').reduce((s, p) => s + p.amount, 0)

  const summaryCards = [
    { label: 'Toplam',  value: total,       color: '#c8d6f0' },
    { label: 'Nakit',   value: totalNakit,  color: '#34d399' },
    { label: 'Havale',  value: totalHavale, color: '#38bdf8' },
    { label: 'Kart',    value: totalKart,   color: '#a78bfa' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Hesaplamalar</h1>

      {/* Özet */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {summaryCards.map(c => (
          <div key={c.label} className="rounded-2xl p-4" style={CARD}>
            <p className="text-xs mb-1" style={{ color: '#7b93c4' }}>{c.label}</p>
            <p className="text-xl font-bold" style={{ color: c.color }}>{formatPrice(c.value)}</p>
          </div>
        ))}
      </div>

      {/* Filtreler */}
      <div className="space-y-3 mb-6">
        <input
          type="text"
          placeholder="Üye ara..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-3 rounded-xl text-sm outline-none"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: '#c8d6f0' }}
        />
        <div className="flex gap-2 flex-wrap">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="flex-1 min-w-32 px-3 py-2 rounded-xl text-xs outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: '#c8d6f0' }} />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="flex-1 min-w-32 px-3 py-2 rounded-xl text-xs outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: '#c8d6f0' }} />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo('') }}
              className="px-3 py-2 rounded-xl text-xs font-bold"
              style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}>
              Temizle
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {METHOD_FILTERS.map(f => (
            <button key={f} onClick={() => setMethodFilter(f)}
              className="px-3 py-1 rounded-full text-xs font-bold"
              style={methodFilter === f
                ? { background: '#f59e0b', color: '#0a0f2e' }
                : { background: 'rgba(255,255,255,0.06)', color: '#7b93c4', border: '1px solid rgba(255,255,255,0.08)' }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-center py-8" style={{ color: '#7b93c4' }}>Yükleniyor...</p>
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 && <p style={{ color: '#7b93c4' }}>Ödeme bulunamadı.</p>}
          {filtered.map(p => (
            <div key={p.id} className="rounded-2xl p-4 flex items-center justify-between gap-3" style={CARD}>
              <div className="min-w-0">
                <p className="font-bold text-white truncate">{p.member_name}</p>
                <p className="text-xs mt-0.5" style={{ color: '#7b93c4' }}>{formatDate(p.payment_date)}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-white">{formatPrice(p.amount)}</p>
                <p className="text-xs font-bold mt-0.5 capitalize" style={{ color: METHOD_COLOR[p.payment_method] ?? '#7b93c4' }}>
                  {p.payment_method}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
