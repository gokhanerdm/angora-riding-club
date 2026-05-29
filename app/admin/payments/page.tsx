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

type Payment = {
  id: string
  member_name: string
  amount: number
  payment_method: string
  payment_date: string
  created_at: string
}

const METHOD_FILTERS = ['Tümü', 'Nakit', 'Havale', 'Kart']
const METHOD_COLOR: Record<string, string> = {
  nakit: 'bg-green-100 text-green-700',
  havale: 'bg-blue-100 text-blue-700',
  kart: 'bg-purple-100 text-purple-700',
}

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
      .select('id, amount, payment_method, payment_date, created_at, members(name, surname)')
      .is('deleted_at', null)
      .order('payment_date', { ascending: false })

    setPayments((data ?? []).map((p: any) => {
      const m = Array.isArray(p.members) ? p.members[0] : p.members
      return {
        id: p.id,
        member_name: m ? `${m.name} ${m.surname}` : 'Bilinmiyor',
        amount: p.amount,
        payment_method: p.payment_method,
        payment_date: p.payment_date,
        created_at: p.created_at,
      }
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

  const total = filtered.reduce((sum, p) => sum + p.amount, 0)
  const totalNakit = filtered.filter(p => p.payment_method === 'nakit').reduce((sum, p) => sum + p.amount, 0)
  const totalHavale = filtered.filter(p => p.payment_method === 'havale').reduce((sum, p) => sum + p.amount, 0)
  const totalKart = filtered.filter(p => p.payment_method === 'kart').reduce((sum, p) => sum + p.amount, 0)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Ödemeler</h1>

      {/* Özet kartlar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Toplam</p>
          <p className="text-xl font-bold text-gray-900">{formatPrice(total)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Nakit</p>
          <p className="text-xl font-bold text-green-700">{formatPrice(totalNakit)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Havale</p>
          <p className="text-xl font-bold text-blue-700">{formatPrice(totalHavale)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Kart</p>
          <p className="text-xl font-bold text-purple-700">{formatPrice(totalKart)}</p>
        </div>
      </div>

      {/* Filtreler */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex gap-3 flex-wrap">
          <input type="text" placeholder="Üye ara..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-40 px-4 py-2 border rounded-lg text-gray-900 text-sm" />
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-4 py-2 border rounded-lg text-gray-900 text-sm" />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-4 py-2 border rounded-lg text-gray-900 text-sm" />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo('') }}
              className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-600 hover:bg-gray-200">
              Temizle
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {METHOD_FILTERS.map(f => (
            <button key={f} onClick={() => setMethodFilter(f)}
              className={`px-3 py-1 rounded-full text-sm font-bold ${methodFilter === f ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? <p className="text-gray-500">Yükleniyor...</p> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-600">Üye</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-600">Tutar</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-600">Yöntem</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-600">Tarih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="text-center py-8 text-gray-400">Ödeme bulunamadı.</td></tr>
              )}
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-bold text-gray-900">{p.member_name}</td>
                  <td className="px-4 py-3 text-sm font-bold text-gray-900">{formatPrice(p.amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-bold ${METHOD_COLOR[p.payment_method] ?? 'bg-gray-100 text-gray-600'}`}>
                      {p.payment_method.charAt(0).toUpperCase() + p.payment_method.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDate(p.payment_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}