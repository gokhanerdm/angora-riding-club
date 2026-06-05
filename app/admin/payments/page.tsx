'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const MONTHS_TR = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']
const DAYS_TR   = ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt']

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function fmt(n: number) {
  if (n >= 1000) return new Intl.NumberFormat('tr-TR').format(Math.round(n)) + '₺'
  return String(Math.round(n))
}

const ROW = { borderBottom: '1px solid rgba(255,255,255,0.05)' }
const HDR = { color: '#7b93c4', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1 }

export default function PaymentsPage() {
  const today = new Date()
  const [day,  setDay]  = useState(new Date(today))
  const [month, setMonth] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const [data,  setData]  = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [day, month])

  const load = async () => {
    setLoading(true)
    const supabase = createClient()

    const dayStr   = toDateStr(day)
    const monthStr = `${month.y}-${String(month.m+1).padStart(2,'0')}`
    const monthStart = `${monthStr}-01`
    const monthEnd   = new Date(month.y, month.m+1, 1).toISOString().split('T')[0]

    const [
      { data: ptAll },
      { data: ptDay },
      { data: ptMonth },
      { data: resAll },
      { data: resDay },
      { data: resMonth },
      { data: msAll },
      { data: msDay },
      { data: msMonth },
      { data: trainers },
    ] = await Promise.all([
      // Tüm ödemeler
      supabase.from('payment_transactions').select('amount').is('deleted_at', null),
      // Günlük ödemeler
      supabase.from('payment_transactions').select('amount').is('deleted_at', null).eq('payment_date', dayStr),
      // Aylık ödemeler
      supabase.from('payment_transactions').select('amount').is('deleted_at', null).gte('payment_date', monthStart).lt('payment_date', monthEnd),
      // Tüm işlenen dersler
      supabase.from('reservations').select('trainer_id, trainers(name,surname)').in('status', ['completed','no_show']),
      // Günlük işlenen dersler
      supabase.from('reservations').select('trainer_id, trainers(name,surname)').in('status', ['completed','no_show']).eq('scheduled_date', dayStr),
      // Aylık işlenen dersler
      supabase.from('reservations').select('trainer_id, trainers(name,surname)').in('status', ['completed','no_show']).gte('scheduled_date', monthStart).lt('scheduled_date', monthEnd),
      // Tüm paketler
      supabase.from('memberships').select('total_lessons, created_at'),
      // Günlük paketler
      supabase.from('memberships').select('total_lessons').gte('created_at', dayStr + 'T00:00:00').lt('created_at', dayStr + 'T23:59:59'),
      // Aylık paketler
      supabase.from('memberships').select('total_lessons').gte('created_at', monthStart + 'T00:00:00').lt('created_at', monthEnd + 'T00:00:00'),
      // Eğitmenler
      supabase.from('trainers').select('id, name, surname, bonus_rate').is('deleted_at', null).order('name'),
    ])

    // Gelir toplamları
    const gelirAll   = (ptAll   ?? []).reduce((s: number, p: any) => s + (p.amount ?? 0), 0)
    const gelirDay   = (ptDay   ?? []).reduce((s: number, p: any) => s + (p.amount ?? 0), 0)
    const gelirMonth = (ptMonth ?? []).reduce((s: number, p: any) => s + (p.amount ?? 0), 0)

    // İşlenen ders sayıları
    const dersAll   = (resAll   ?? []).length
    const dersDay   = (resDay   ?? []).length
    const dersMonth = (resMonth ?? []).length

    // Paket sayıları
    const paketAll   = (msAll   ?? []).length
    const paketDay   = (msDay   ?? []).length
    const paketMonth = (msMonth ?? []).length

    // Satılan ders (paket içindeki toplam ders)
    const satisAll   = (msAll   ?? []).reduce((s: number, m: any) => s + (m.total_lessons ?? 0), 0)
    const satisDay   = (msDay   ?? []).reduce((s: number, m: any) => s + (m.total_lessons ?? 0), 0)
    const satisMonth = (msMonth ?? []).reduce((s: number, m: any) => s + (m.total_lessons ?? 0), 0)

    // Eğitmen bazlı ders sayısı
    const trainerRows = (trainers ?? []).map((t: any) => {
      const countRes = (res: any[]) => (res ?? []).filter((r: any) => r.trainer_id === t.id).length
      return {
        id: t.id,
        name: `${t.name} ${t.surname}`,
        bonusRate: t.bonus_rate ?? 0,
        dersAll:   countRes(resAll   ?? []),
        dersDay:   countRes(resDay   ?? []),
        dersMonth: countRes(resMonth ?? []),
      }
    }).filter((t: any) => t.dersAll > 0 || t.dersDay > 0 || t.dersMonth > 0)

    setData({ gelirAll, gelirDay, gelirMonth, dersAll, dersDay, dersMonth, paketAll, paketDay, paketMonth, satisAll, satisDay, satisMonth, trainerRows })
    setLoading(false)
  }

  const prevDay  = () => { const d = new Date(day); d.setDate(d.getDate()-1); setDay(d) }
  const nextDay  = () => { const d = new Date(day); d.setDate(d.getDate()+1); setDay(d) }
  const prevMonth = () => { if (month.m === 0) setMonth({ y: month.y-1, m: 11 }); else setMonth({ y: month.y, m: month.m-1 }) }
  const nextMonth = () => { if (month.m === 11) setMonth({ y: month.y+1, m: 0 }); else setMonth({ y: month.y, m: month.m+1 }) }

  const dayLabel = `${day.getDate()} ${MONTHS_TR[day.getMonth()]} ${DAYS_TR[day.getDay()]}`
  const monthLabel = `${MONTHS_TR[month.m]} ${month.y}`

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-5">Hesaplamalar</h1>

      {loading ? (
        <p className="text-center py-12" style={{ color: '#7b93c4' }}>Yükleniyor...</p>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>

          {/* Başlık satırı */}
          <div className="grid px-4 py-3" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <p style={HDR}>Bilgi</p>

            {/* Gün başlığı */}
            <div className="flex items-center gap-1">
              <button onClick={prevDay} className="text-xs px-1.5 py-0.5 rounded" style={{ color: '#7b93c4', background: 'rgba(255,255,255,0.06)' }}>‹</button>
              <p style={{ ...HDR, fontSize: 9 }}>{dayLabel}</p>
              <button onClick={nextDay} className="text-xs px-1.5 py-0.5 rounded" style={{ color: '#7b93c4', background: 'rgba(255,255,255,0.06)' }}>›</button>
            </div>

            {/* Ay başlığı */}
            <div className="flex items-center gap-1">
              <button onClick={prevMonth} className="text-xs px-1.5 py-0.5 rounded" style={{ color: '#7b93c4', background: 'rgba(255,255,255,0.06)' }}>‹</button>
              <p style={{ ...HDR, fontSize: 9 }}>{monthLabel}</p>
              <button onClick={nextMonth} className="text-xs px-1.5 py-0.5 rounded" style={{ color: '#7b93c4', background: 'rgba(255,255,255,0.06)' }}>›</button>
            </div>

            <p style={HDR}>Toplam</p>
          </div>

          {/* Satırlar */}
          {[
            { label: 'Gelir',          day: data.gelirDay,   month: data.gelirMonth,   all: data.gelirAll,   color: '#34d399', isMoney: true },
            { label: 'Satılan Paket',  day: data.paketDay,   month: data.paketMonth,   all: data.paketAll,   color: '#38bdf8', isMoney: false },
            { label: 'Satılan Ders',   day: data.satisDay,   month: data.satisMonth,   all: data.satisAll,   color: '#a78bfa', isMoney: false },
            { label: 'İşlenen Ders',   day: data.dersDay,    month: data.dersMonth,    all: data.dersAll,    color: '#f59e0b', isMoney: false },
          ].map(row => (
            <div key={row.label} className="grid px-4 py-3 items-center" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, ...ROW }}>
              <p className="text-xs font-bold" style={{ color: '#c8d6f0' }}>{row.label}</p>
              <p className="text-sm font-bold" style={{ color: row.color }}>{row.isMoney ? fmt(row.day) : row.day}</p>
              <p className="text-sm font-bold" style={{ color: row.color }}>{row.isMoney ? fmt(row.month) : row.month}</p>
              <p className="text-sm font-bold" style={{ color: row.color }}>{row.isMoney ? fmt(row.all) : row.all}</p>
            </div>
          ))}

          {/* Eğitmen satırları */}
          {data.trainerRows.length > 0 && (
            <>
              <div className="px-4 py-2" style={{ background: 'rgba(167,139,250,0.06)', borderTop: '1px solid rgba(167,139,250,0.15)' }}>
                <p style={{ ...HDR, color: '#a78bfa' }}>Eğitmen Dersleri</p>
              </div>
              {data.trainerRows.map((t: any) => (
                <div key={t.id} className="grid px-4 py-3 items-center" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, ...ROW }}>
                  <p className="text-xs font-bold" style={{ color: '#c8d6f0' }}>{t.name}</p>
                  <p className="text-sm font-bold" style={{ color: '#c8d6f0' }}>{t.dersDay}</p>
                  <p className="text-sm font-bold" style={{ color: '#c8d6f0' }}>{t.dersMonth}</p>
                  <p className="text-sm font-bold" style={{ color: '#c8d6f0' }}>{t.dersAll}</p>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
